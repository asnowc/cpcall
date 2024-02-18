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
  let bufRaw = encodeCpcFrame(frame);
  const dbnLen = DBN.calcU32DByte(bufRaw.byteLength);
  const u8Arr = new Uint8Array(dbnLen + bufRaw.byteLength);
  const offset = DBN.encodeU32DInto(bufRaw.byteLength, u8Arr);
  u8Arr.set(bufRaw, offset);
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
export function encodeCpcFrame(frame: RpcFrame): Uint8Array {
  const type = frame[0];
  const writeList: Uint8Array[] = [createTypeFlagBuf(type)];
  let contentLen = 1;
  if (type === FrameType.call || type === FrameType.exec) {
    const argBuf = JBOD.encodeContent(frame[1]);
    writeList.push(argBuf);
    contentLen += argBuf.byteLength;
  } else if (type === FrameType.reject || type === FrameType.resolve) {
    const len2 = DBN.calcU32DByte(frame[1]);
    const pre = JBOD.byteLength(frame[2]);
    const frameLen = pre.byteLength + len2;
    const buf = new Uint8Array(frameLen);
    let offset = DBN.encodeU32DInto(frame[1], buf);
    buf[offset++] = pre.type;
    JBOD.encodeContentInto(pre, buf, offset);

    writeList.push(buf); //value
    contentLen += frameLen;
  } else {
    switch (type) {
      case FrameType.return: {
        const valueBuf = JBOD.encode(frame[1]);
        writeList.push(valueBuf); //value
        contentLen += valueBuf.byteLength;
        break;
      }
      case FrameType.throw: {
        const valueBuf = JBOD.encode(frame[1]);
        writeList.push(valueBuf); //value
        contentLen += valueBuf.byteLength;
        break;
      }
      case FrameType.promise: {
        let len = DBN.calcU32DByte(frame[1]);
        const buf = new Uint8Array(len);
        DBN.encodeU32DInto(frame[1], buf);
        writeList.push(buf); //id
        contentLen += len;
        break;
      }
    }
  }
  return concatUint8ArrayList(writeList, contentLen);
}
function concatUint8ArrayList(list: Uint8Array[], totalLen: number) {
  let frameBuf = new Uint8Array(totalLen);
  let offset = 0;
  for (let i = 0; i < list.length; i++) {
    frameBuf.set(list[i], offset);
    offset += list[i].byteLength;
  }
  return frameBuf;
}
function createTypeFlagBuf(type: number) {
  const t = new Uint8Array(1);
  t[0] = type;
  return t;
}
