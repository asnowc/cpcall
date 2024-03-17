import { FrameType } from "../const.js";
import { RpcFrame } from "../type.js";
import JBOD, { DataType, varints, UnsupportedDataTypeError, DataWriter } from "jbod";
import { StepsByteParser, LengthByteParser } from "evlib/async";
import { U32DByteParser } from "../../lib/mod.js";

function createCpcFrameParser() {
  return new StepsByteParser<Uint8Array>({ first: new U32DByteParser() }, (len: number) => new LengthByteParser(len));
}

/** @internal */
export async function* createFrameIterator(iter: AsyncIterable<Uint8Array>) {
  const parser = createCpcFrameParser();
  let chunk: Uint8Array | undefined;
  for await (chunk of iter) {
    do {
      if (parser.next(chunk!)) {
        const res = parser.finish();
        let decRes: ReturnType<typeof decodeCpcFrame> = { offset: 0, frame: [] as any };
        do {
          decRes = decodeCpcFrame(res.value, decRes.offset);
          yield decRes.frame;
        } while (decRes.offset < res.value.byteLength);
        chunk = res.residue;
      }
    } while (chunk);
  }
  return chunk;
}

/** @internal */
export function packageCpcFrame(frame: RpcFrame) {
  const cpcEncoder = new CpcFrameEncoder(frame);
  const dbnLen = varints.calcU32DByte(cpcEncoder.byteLength);
  const u8Arr = new Uint8Array(dbnLen + cpcEncoder.byteLength);

  let offset = varints.encodeU32DInto(cpcEncoder.byteLength, u8Arr);
  offset = cpcEncoder.encodeInto(u8Arr, offset);
  return u8Arr;
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
export default { createFrameIterator, packageCpcFrame, decodeCpcFrame, CpcFrameEncoder };
