import { DataType, JBSON, VOID, toArrayJBSON, toArrayItemJBSON, DLD, numToDLD } from "@eavid/js-bson";
import { CpcFrame, CpcUnknownFrameTypeError, FrameType } from "./cpc.js";

export function readCpcFrame(frame: Uint8Array): CpcFrame {
    const type: FrameType = frame[0];
    if (type === FrameType.call || type === FrameType.exec) {
        const args = JBSON.toArray(frame, 1);
        return [type, args];
    } else if (type === FrameType.reject || type === FrameType.resolve) {
        const [id, len] = DLD.readNumberSync(frame, 1);
        const [value] = JBSON.toArrayItem<string>(frame, len + 1);
        return [type, id, value];
    } else {
        switch (type) {
            case FrameType.return: {
                const [value] = JBSON.toArrayItem(frame, 1);
                return [type, value];
            }
            case FrameType.throw: {
                if (frame[1] === DataType.void) return [type, VOID];

                const [value] = JBSON.toArrayItem(frame, 1);
                return [type, value];
            }
            case FrameType.returnAsync: {
                const [id] = DLD.readNumberSync(frame, 1);
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
        const argBuf = toArrayJBSON(frame[1], true);
        writeList.push(argBuf);
        contentLen += argBuf.byteLength;
    } else if (type === FrameType.reject || type === FrameType.resolve) {
        const idBuf = numToDLD(frame[1]);
        const valueBuf = toArrayItemJBSON(frame[2]);
        writeList.push(idBuf); //id
        writeList.push(valueBuf); //value
        contentLen += idBuf.byteLength;
        contentLen += valueBuf.byteLength;
    } else {
        switch (type) {
            case FrameType.return: {
                const valueBuf = toArrayItemJBSON(frame[1]);
                writeList.push(valueBuf); //value
                contentLen += valueBuf.byteLength;
                break;
            }
            case FrameType.throw: {
                //isNoExist
                if (frame[1] === VOID) {
                    writeList.push(createTypeFlagBuf(DataType.void)); //write void
                    contentLen += 1;
                } else {
                    const valueBuf = toArrayItemJBSON(frame[1]);
                    writeList.push(valueBuf); //value
                    contentLen += valueBuf.byteLength;
                }
                break;
            }
            case FrameType.returnAsync: {
                const idBuf = numToDLD(frame[1]);
                writeList.push(idBuf); //id
                contentLen += idBuf.byteLength;
                break;
            }
        }
    }
    return [writeList, contentLen];
}
function createTypeFlagBuf(type: number) {
    const t = new Uint8Array(1);
    t[0] = type;
    return t;
}
