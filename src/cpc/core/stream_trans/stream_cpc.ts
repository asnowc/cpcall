import { FrameType } from "../const.js";
import { RpcFrame } from "../type.js";
import JBOD, { DataType, varints, UnsupportedDataTypeError, DataWriter } from "jbod";
import { StepsByteParser, LengthByteParser } from "evlib/async";
import { U32DByteParser } from "../../lib/mod.js";

function createCpcFrameParser() {
  return new StepsByteParser<Uint8Array>({ first: new U32DByteParser() }, (len: number) => new LengthByteParser(len));
}

/** 解码二进制帧。输入应该是通过 packageCpcFrame 生成的二进制块，可以是经过流的碎片
 *  @internal */
export async function* createFrameIterator(iter: AsyncIterable<Uint8Array>) {
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
/** @internal */
export function packCpcFrames(frames: RpcFrame[]) {
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
/** @internal 解码由 packCpcFrames 生成的二进制帧*/
export function* unpackCpcFrames(buf: Uint8Array, offset: number) {
  let decRes: ReturnType<typeof decodeCpcFrame>;
  do {
    decRes = decodeCpcFrame(buf, offset);
    yield decRes.frame;
    offset = decRes.offset;
  } while (offset < buf.byteLength);
}

/** @internal */
export function decodeCpcFrame(buf: Uint8Array, offset = 0): { frame: RpcFrame; offset: number } {
  const type: FrameType = buf[offset++];
  let frame: RpcFrame;

  if (type === FrameType.call || type === FrameType.exec) {
    const res = JBOD.decode(buf, offset, DataType.anyArray);
    frame = [type, res.data];
    offset = res.offset;
  } else if (type === FrameType.reject || type === FrameType.resolve) {
    const res = varints.decodeU32D(buf, offset);
    offset += res.byte;
    const value = JBOD.decode(buf, offset);
    frame = [type, res.value, value.data];
    offset = value.offset;
  } else {
    switch (type) {
      case FrameType.return: {
        const res = JBOD.decode(buf, offset);
        frame = [type, res.data];
        offset = res.offset;
        return { frame, offset };
      }
      case FrameType.throw: {
        const res = JBOD.decode(buf, offset);
        frame = [type, res.data];
        offset = res.offset;
        return { frame, offset };
      }
      case FrameType.promise: {
        const res = varints.decodeU32D(buf, offset);
        offset += res.byte;
        return { frame: [type, res.value], offset };
      }
      case FrameType.end:
        return { frame: [FrameType.end], offset };
      case FrameType.disable:
        return { frame: [FrameType.disable], offset };
      default:
        throw new UnsupportedDataTypeError(type);
    }
  }
  return { frame, offset };
}

/** @internal */
export class CpcFrameEncoder {
  readonly type: FrameType;
  constructor(frame: RpcFrame) {
    this.type = frame[0];
    const type = this.type;
    if (type === FrameType.call || type === FrameType.exec) {
      this.pre = JBOD.createContentWriter(frame[1]);
      this.byteLength = this.pre.byteLength + 1;
    } else if (type === FrameType.reject || type === FrameType.resolve) {
      const len2 = varints.calcU32DByte(frame[1]);
      const pre = JBOD.createWriter(frame[2]);
      this.byteLength = 1 + pre.byteLength + len2;
      this.pre = { id: frame[1], body: pre };
    } else {
      if (type === FrameType.return || type === FrameType.throw) {
        this.pre = JBOD.createWriter(frame[1]);
        this.byteLength = this.pre.byteLength + 1;
      } else if (type === FrameType.promise) {
        this.pre = frame[1];
        this.byteLength = varints.calcU32DByte(frame[1]) + 1;
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

/** @internal */
export default { createFrameIterator, packCpcFrames, decodeCpcFrame, unpackCpcFrames, CpcFrameEncoder };
