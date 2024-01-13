import { CpcFrame, CpcUnknownFrameTypeError, FrameType } from "./cpc.js";
import JBOD, { DBN, DataType } from "jbod";
import { VOID } from "./private/const.js";

export function readCpcFrame(frame: Uint8Array): CpcFrame {
  const type: FrameType = frame[0];
  if (type === FrameType.call || type === FrameType.exec) {
    const args = JBOD.parse<unknown[]>(frame.subarray(1), DataType.array).data;
    return [type, args];
  } else if (type === FrameType.reject || type === FrameType.resolve) {
    const [id, len] = DBN.paseNumberSync(frame, 1);
    const value = JBOD.parse(frame.subarray(len + 1)).data;
    return [type, id, value];
  } else {
    switch (type) {
      case FrameType.return: {
        const value = JBOD.parse(frame.subarray(1)).data;
        return [type, value];
      }
      case FrameType.throw: {
        if (frame[1] === DataType.void) return [type, VOID];

        const value = JBOD.parse(frame.subarray(1)).data;
        return [type, value];
      }
      case FrameType.returnAsync: {
        const [id] = DBN.paseNumberSync(frame, 1);
        return [type, id];
      }
      case FrameType.fin:
        return [FrameType.fin];
      default:
        throw new CpcUnknownFrameTypeError(type);
    }
  }
}

export function sendCpcFrame(frame: CpcFrame): [Uint8Array[], number] {
  const type = frame[0];
  const writeList: Uint8Array[] = [createTypeFlagBuf(type)];
  let contentLen = 1;
  if (type === FrameType.call || type === FrameType.exec) {
    const argBuf = JBOD.binaryifyContent(frame[1]);
    writeList.push(argBuf);
    contentLen += argBuf.byteLength;
  } else if (type === FrameType.reject || type === FrameType.resolve) {
    const idBuf = DBN.numToBinary(frame[1]);
    const valueBuf = JBOD.binaryify(frame[2]);
    writeList.push(idBuf); //id
    writeList.push(valueBuf); //value
    contentLen += idBuf.byteLength;
    contentLen += valueBuf.byteLength;
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
        //isNoExist
        if (frame[1] === VOID) {
          writeList.push(createTypeFlagBuf(DataType.void)); //write void
          contentLen += 1;
        } else {
          const valueBuf = JBOD.binaryifyContent(frame[1]);
          writeList.push(new Uint8Array([JBOD.getType(frame[1])]));
          writeList.push(valueBuf); //value
          contentLen += valueBuf.byteLength + 1;
        }
        break;
      }
      case FrameType.returnAsync: {
        const idBuf = DBN.numToBinary(frame[1]);
        writeList.push(idBuf); //id
        contentLen += idBuf.byteLength;
        break;
      }
    }
  }
  return [writeList, contentLen];
}
export function concatUint8ArrayList(list: Uint8Array[], totalLen: number) {
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
