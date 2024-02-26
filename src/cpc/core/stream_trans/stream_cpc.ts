import { FrameType } from "../const.js";
import { RpcFrame } from "../type.js";
import JBOD, { DataType, DBN, UnsupportedDataTypeError } from "jbod";
import { StepsByteParser, LengthByteParser } from "evlib/async";
import { U32DByteParser } from "../../lib/mod.js";

function createCpcFrameParser() {
  return new StepsByteParser(
    { first: new U32DByteParser(), final: decodeCpcFrame },
    (len: number) => new LengthByteParser(len)
  );
}
export async function* createFrameIterator(iter: AsyncIterable<Uint8Array>) {
  const parser = createCpcFrameParser();
  let chunk: Uint8Array | undefined;
  for await (chunk of iter) {
    do {
      if (parser.next(chunk!)) {
        const res = parser.finish();
        yield res.value;
        chunk = res.residue;
      }
    } while (chunk);
  }
  return chunk;
}

/** @internal */
export function packageCpcFrame(frame: RpcFrame) {
  const cpcEncoder = new CpcFrameEncoder(frame);
  const dbnLen = DBN.calcU32DByte(cpcEncoder.byteLength);
  const u8Arr = new Uint8Array(dbnLen + cpcEncoder.byteLength);

  let offset = DBN.encodeU32DInto(cpcEncoder.byteLength, u8Arr);
  offset = cpcEncoder.encodeInto(u8Arr, offset);
  return u8Arr;
}

/** @internal */
export function decodeCpcFrame(frame: Uint8Array): RpcFrame {
  let offset = 0;
  const type: FrameType = frame[offset++];
  if (type === FrameType.call || type === FrameType.exec) {
    const args = JBOD.decode(frame, offset, DataType.dyArray).data as unknown[];
    return [type, args];
  } else if (type === FrameType.reject || type === FrameType.resolve) {
    const res = DBN.decodeU32D(frame, offset);
    offset += res.byte;
    const value = JBOD.decode(frame, offset).data;
    return [type, res.value, value];
  } else {
    switch (type) {
      case FrameType.return: {
        const value = JBOD.decode(frame, offset).data;
        return [type, value];
      }
      case FrameType.throw: {
        const value = JBOD.decode(frame, offset).data;
        return [type, value];
      }
      case FrameType.promise: {
        const id = DBN.decodeU32D(frame, offset).value;
        return [type, id];
      }
      case FrameType.end:
        return [FrameType.end];
      case FrameType.disable:
        return [FrameType.disable];
      default:
        throw new UnsupportedDataTypeError(type);
    }
  }
}

/** @internal */
export class CpcFrameEncoder {
  readonly type: FrameType;
  constructor(frame: RpcFrame) {
    this.type = frame[0];
    const type = this.type;
    if (type === FrameType.call || type === FrameType.exec) {
      this.pre = JBOD.byteLength(frame[1]);
      this.byteLength = this.pre.byteLength;
    } else if (type === FrameType.reject || type === FrameType.resolve) {
      const len2 = DBN.calcU32DByte(frame[1]);
      const pre = JBOD.byteLength(frame[2]);
      this.byteLength = 1 + pre.byteLength + len2;
      this.pre = { id: frame[1], body: pre };
    } else {
      if (type === FrameType.return || type === FrameType.throw) {
        this.pre = JBOD.byteLength(frame[1]);
        this.byteLength = this.pre.byteLength + 1;
      } else if (type === FrameType.promise) {
        this.pre = frame[1];
        this.byteLength = DBN.calcU32DByte(frame[1]) + 1;
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
      offset = JBOD.encodeContentInto(this.pre, buf, offset);
    } else if (type === FrameType.reject || type === FrameType.resolve) {
      offset = DBN.encodeU32DInto(this.pre.id, buf, offset);
      offset = JBOD.encodeInto(this.pre.body, buf, offset);
    } else {
      if (type === FrameType.return || type === FrameType.throw) {
        offset = JBOD.encodeInto(this.pre, buf, offset);
      } else if (type === FrameType.promise) {
        offset = DBN.encodeU32DInto(this.pre, buf, offset);
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
