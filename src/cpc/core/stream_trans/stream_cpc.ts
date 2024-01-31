import { FrameType } from "../const.js";
import { RpcFrame } from "../type.js";
import JBOD, { DataType, encodeU32DInto, calcU32DByte, decodeU32D, UnsupportedDataTypeError } from "jbod";
import { StepsParser, LengthByteParser, U32DByteParser } from "../../lib/mod.js";

function createCpcFrameParser() {
  return new StepsParser(
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
        const res = parser.end();
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
  const dbnLen = calcU32DByte(bufRaw.byteLength);
  const u8Arr = new Uint8Array(dbnLen + bufRaw.byteLength);
  const offset = encodeU32DInto(bufRaw.byteLength, u8Arr);
  u8Arr.set(bufRaw, offset);
  return u8Arr;
}

/** @internal */
export function decodeCpcFrame(frame: Uint8Array): RpcFrame {
  const type: FrameType = frame[0];
  if (type === FrameType.call || type === FrameType.exec) {
    const args = JBOD.parse<unknown[]>(frame.subarray(1), DataType.dyArray).data;
    return [type, args];
  } else if (type === FrameType.reject || type === FrameType.resolve) {
    const { byte, value: id } = decodeU32D(frame.subarray(1));
    const value = JBOD.parse(frame.subarray(byte + 1)).data;
    return [type, id, value];
  } else {
    switch (type) {
      case FrameType.return: {
        const value = JBOD.parse(frame.subarray(1)).data;
        return [type, value];
      }
      case FrameType.throw: {
        const value = JBOD.parse(frame.subarray(1)).data;
        return [type, value];
      }
      case FrameType.promise: {
        const id = decodeU32D(frame.subarray(1)).value;
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
    const argBuf = JBOD.binaryifyContent(frame[1]);
    writeList.push(argBuf);
    contentLen += argBuf.byteLength;
  } else if (type === FrameType.reject || type === FrameType.resolve) {
    const len2 = calcU32DByte(frame[1]);
    const pre = JBOD.calcLen(frame[2]);
    const frameLen = pre.byteLength + len2 + 1;
    const buf = new Uint8Array(frameLen);
    const offset = encodeU32DInto(frame[1], buf);
    buf[offset] = pre.type;
    JBOD.encodeInto(pre, buf.subarray(offset + 1));

    writeList.push(buf); //value
    contentLen += frameLen;
  } else {
    switch (type) {
      case FrameType.return: {
        const valueBuf = JBOD.binaryifyContent(frame[1]);
        writeList.push(new Uint8Array([JBOD.getType(frame[1])]));
        writeList.push(valueBuf); //value
        contentLen += valueBuf.byteLength + 1;
        break;
      }
      case FrameType.throw: {
        const valueBuf = JBOD.binaryifyContent(frame[1]);
        writeList.push(new Uint8Array([JBOD.getType(frame[1])]));
        writeList.push(valueBuf); //value
        contentLen += valueBuf.byteLength + 1;
        break;
      }
      case FrameType.promise: {
        let len = calcU32DByte(frame[1]);
        const buf = new Uint8Array(len);
        encodeU32DInto(frame[1], buf);
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
