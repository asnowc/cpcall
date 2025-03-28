import { FrameType } from "../core/const.ts";
import { RpcFrame, Frame } from "../core/type.ts";
import JBOD, { DataType, varints, UnsupportedDataTypeError, DataWriter } from "jbod";
import { ByteParser } from "../../deps/evlib.ts";

const U32DByteParser = varints.U32DByteParser;

/** 收集二进制chunk, 拼接成完整的二进制帧 */
export function createCpcFrameParser(): ByteParser<Uint8Array> {
  return new CpcFrameByteParser();
}

/** 解码二进制帧。输入应该是通过 packageCpcFrame 生成的二进制块，可以是经过流的碎片 */
export async function* createFrameIterator(
  iter: AsyncIterable<Uint8Array>
): AsyncGenerator<RpcFrame, Uint8Array | undefined, unknown> {
  const parser = createCpcFrameParser();
  let chunk: Uint8Array | undefined;
  for await (chunk of iter) {
    do {
      if (parser.next(chunk!)) {
        const res = parser.finish();
        let offset = 0;
        let decRes: ReturnType<typeof decodeCpcFrame>;
        do {
          decRes = decodeCpcFrame(res.value, offset);
          yield decRes.frame;
          offset = decRes.offset;
        } while (decRes.offset < res.value.byteLength);
        chunk = res.residue;
      }
    } while (chunk);
  }
  return chunk;
}
/** 将多个 RpcFrame 打包多个成二进制帧 JBOD-CPC 帧 */
export function packCpcFrames(frames: RpcFrame[]): Uint8Array {
  const encoderList: CpcFrameEncoder[] = new Array(frames.length);
  let len = 0;
  for (let i = 0; i < frames.length; i++) {
    const cpcEncoder = new CpcFrameEncoder(frames[i]);
    encoderList[i] = cpcEncoder;
    const dbnLen = varints.calcU32DByte(cpcEncoder.byteLength);
    len += dbnLen + cpcEncoder.byteLength;
  }

  const u8Arr = new Uint8Array(len);
  let offset = 0;
  for (let i = 0; i < encoderList.length; i++) {
    offset = varints.encodeU32DInto(encoderList[i].byteLength, u8Arr, offset);
    offset = encoderList[i].encodeInto(u8Arr, offset);
  }
  return u8Arr;
}
/** 解码由 packCpcFrames 生成的二进制帧 */
export function* unpackCpcFrames(buf: Uint8Array, offset: number): Generator<RpcFrame, void, void> {
  let decRes: ReturnType<typeof decodeCpcFrame>;
  do {
    let res = varints.decodeU32D(buf, offset);
    offset += res.byte;
    const chunk = buf.subarray(offset, res.value + offset);

    decRes = decodeCpcFrame(chunk, 0);
    yield decRes.frame;
    offset += res.value;
  } while (offset < buf.byteLength);
}

/* 单个帧 */

/** 解码二进制 JBOD-CPC 帧 */
export function decodeCpcFrame(buf: Uint8Array, offset = 0): { frame: RpcFrame; offset: number } {
  const type: FrameType = buf[offset++];
  let frame: RpcFrame;

  if (type === FrameType.call || type === FrameType.exec) {
    const res = JBOD.decode(buf, offset, DataType.anyArray);
    frame = { type, args: res.data } satisfies Frame.Call | Frame.Exec;
    offset = res.offset;
  } else if (type === FrameType.reject || type === FrameType.resolve) {
    const res = varints.decodeU32D(buf, offset);
    offset += res.byte;
    const value = JBOD.decode(buf, offset);
    frame = { type, id: res.value, value: value.data } satisfies Frame.Reject | Frame.Resolve;
    offset = value.offset;
  } else {
    switch (type) {
      case FrameType.return: {
        const res = JBOD.decode(buf, offset);
        frame = { type, value: res.data };
        offset = res.offset;
        return { frame, offset };
      }
      case FrameType.throw: {
        const res = JBOD.decode(buf, offset);
        frame = { type, value: res.data };
        offset = res.offset;
        return { frame, offset };
      }
      case FrameType.promise: {
        const res = varints.decodeU32D(buf, offset);
        offset += res.byte;
        return { frame: { type, id: res.value }, offset };
      }
      case FrameType.endCall:
        return { frame: { type: FrameType.endCall }, offset };
      case FrameType.endServe:
        return { frame: { type: FrameType.endServe }, offset };
      default:
        throw new UnsupportedDataTypeError(type);
    }
  }
  return { frame, offset };
}

/** 编码二进制 JBOD-CPC 帧 */
export class CpcFrameEncoder {
  readonly type: FrameType;
  constructor(frame: RpcFrame) {
    const type = frame.type;
    this.type = type;
    if (type === FrameType.call || type === FrameType.exec) {
      this.pre = JBOD.createContentWriter(frame.args);
      this.byteLength = this.pre.byteLength + 1;
    } else if (type === FrameType.reject || type === FrameType.resolve) {
      const len2 = varints.calcU32DByte(frame.id);
      const pre = JBOD.createWriter(frame.value);
      this.byteLength = 1 + pre.byteLength + len2;
      this.pre = { id: frame.id, body: pre };
    } else {
      if (type === FrameType.return || type === FrameType.throw) {
        this.pre = JBOD.createWriter(frame.value);
        this.byteLength = this.pre.byteLength + 1;
      } else if (type === FrameType.promise) {
        this.pre = frame.id;
        this.byteLength = varints.calcU32DByte(frame.id) + 1;
      } else {
        this.byteLength = 1;
      }
    }
  }
  readonly byteLength: number;
  private pre: any;
  encodeInto(buf: Uint8Array, offset = 0): number {
    const type = this.type;
    buf[offset++] = type;
    if (type === FrameType.call || type === FrameType.exec) {
      offset = (this.pre as DataWriter).encodeTo(buf, offset);
    } else if (type === FrameType.reject || type === FrameType.resolve) {
      offset = varints.encodeU32DInto(this.pre.id, buf, offset);
      offset = (this.pre.body as DataWriter).encodeTo(buf, offset);
    } else {
      if (type === FrameType.return || type === FrameType.throw) {
        offset = (this.pre as DataWriter).encodeTo(buf, offset);
      } else if (type === FrameType.promise) {
        offset = varints.encodeU32DInto(this.pre, buf, offset);
      }
    }
    return offset;
  }
  encode() {
    let buf = new Uint8Array(this.byteLength);
    this.encodeInto(buf, 0);
    return buf;
  }
}
class CpcFrameByteParser extends ByteParser<Uint8Array> {
  #u32d = new U32DByteParser();
  #totalLen?: number;
  #requiredLen?: number;
  private list: Uint8Array[] = [];
  next(chunk: Uint8Array): boolean {
    if (this.#totalLen === undefined) {
      if (this.#u32d.next(chunk)) {
        const { value, residue } = this.#u32d.finish();
        this.#requiredLen = value;
        this.#totalLen = value;
        if (residue) return this.#nextBy(residue, value);

        return false;
      }
      return false;
    } else {
      return this.#nextBy(chunk, this.#requiredLen!);
    }
  }
  #nextBy(chunk: Uint8Array, len: number): boolean {
    if (chunk.byteLength > len) {
      this.list.push(chunk.subarray(0, len));
      this.result = { value: this.#concatU8Arr(), residue: chunk.subarray(len) };
      return true;
    } else if (chunk.byteLength === len) {
      this.list.push(chunk);
      this.result = { value: this.#concatU8Arr() };
      return true;
    } else {
      this.list.push(chunk);
      this.#requiredLen = len - chunk.byteLength;
      return false;
    }
  }
  #concatU8Arr(): Uint8Array {
    const totalLen = this.#totalLen!;
    let buf: Uint8Array;
    if (this.list.length === 1) buf = this.list[0];
    else {
      buf = new Uint8Array(totalLen);
      let offset = 0;
      for (let i = 0; i < this.list.length; i++) {
        buf.set(this.list[i], offset);
        offset += this.list[i].byteLength;
      }
    }
    this.list.length = 0;
    this.#totalLen = undefined;
    this.#requiredLen = undefined;
    return buf;
  }
}
