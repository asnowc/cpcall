import { numToDLD } from "../dynamic_len_data.js";
import { DataType, ObjectId, UnsupportedDataTypeError, VOID } from "../const.js";
import { numTransf, strTransf } from "../uint_array_util/mod.js";

export class JBSONWriter {
  isNoContentData(type: number) {
    return type === DataType.true || type === DataType.false || type === DataType.null || type === DataType.undefined;
  }
  toType(data: any, safe?: boolean): number {
    let type: number;
    switch (typeof data) {
      case "undefined":
        return DataType.undefined;
      case "boolean":
        return data ? DataType.true : DataType.false;
      case "number":
        if (data % 1 !== 0 || data < -2147483648 || data > 2147483647) type = DataType.double;
        else type = DataType.int;
        break;
      case "string":
        type = DataType.string;
        break;
      case "bigint":
        type = DataType.bigint;
        break;
      case "symbol":
        type = DataType.symbol;
        break;
      case "object":
        if (data === null) return DataType.null;
        if (Array.isArray(data)) type = DataType.array;
        else if (data instanceof ArrayBuffer) type = DataType.arrayBuffer;
        else if (data instanceof RegExp) type = DataType.regExp;
        else if (data instanceof Error) type = DataType.error;
        else if (data instanceof ObjectId) type = DataType.objectId;
        else type = DataType.map;
        break;
      default:
        if (safe) return DataType.undefined;
        throw new UnsupportedDataTypeError(typeof data);
    }
    return type;
  }

  /** 支持写入void类型 */
  writeArrayItem(data: unknown, write: StreamWriter, safe?: boolean): number {
    if (data === VOID) {
      write(createDataTypeBuf(DataType.void));
      return 1;
    }
    const type = this.toType(data, safe);
    write(createDataTypeBuf(type));
    if (this.isNoContentData(type)) return 1;

    if (typeof this[type] !== "function") throw new UnsupportedDataTypeError(DataType[type] ?? type);
    return this[type](data, write);
  }
  [DataType.int](data: number, write: StreamWriter) {
    let buf = new Uint8Array(4);
    numTransf.writeInt32BE(buf, data);
    write(buf);
    return 4;
  }
  [DataType.bigint](data: bigint, write: StreamWriter) {
    let buf = new Uint8Array(8);
    numTransf.writeBigInt64BE(buf, data);
    write(buf);
    return 8;
  }
  [DataType.double](data: number, write: StreamWriter) {
    let buf = new Uint8Array(8);
    numTransf.writeDoubleBE(buf, data);
    write(buf);
    return 8;
  }

  [DataType.objectId](data: ObjectId, write: StreamWriter) {
    const buf = numToDLD(data.value);
    write(buf);
    return buf.byteLength;
  }
  [DataType.arrayBuffer](data: ArrayBuffer, write: StreamWriter) {
    const dld = numToDLD(data.byteLength);
    write(dld);
    write(new Uint8Array(data));
    return data.byteLength + dld.byteLength;
  }
  [DataType.string](data: string, write: StreamWriter) {
    return this[DataType.arrayBuffer](strTransf.writeByUtf8(data), write);
  }

  [DataType.regExp](data: RegExp, write: StreamWriter) {
    return this[DataType.string](data.source, write);
  }
  [DataType.symbol](data: Symbol, write: StreamWriter) {
    if (data.description === undefined) {
      write(createDataTypeBuf(DataType.void));
      return 1;
    } else {
      write(createDataTypeBuf(DataType.string));
      return this[DataType.string](data.description, write) + 1;
    }
  }
  [DataType.array](array: unknown[], write: StreamWriter, ignoreVoid?: boolean): number {
    let writeTotalLen = 0;
    for (let i = 0; i < array.length; i++) {
      writeTotalLen += this.writeArrayItem(array[i], write, true);
    }
    if (!ignoreVoid) write(createDataTypeBuf(DataType.void));
    return writeTotalLen + 1;
  }
  [DataType.map](map: Record<string, any>, write: StreamWriter, ignoreVoid?: boolean): number {
    let writeTotalLen = 0;
    for (const [key, data] of Object.entries(map)) {
      const type = this.toType(data, true);
      {
        //type
        write(createDataTypeBuf(type));
        writeTotalLen++;

        ///key
        const keyBuf = strTransf.writeByUtf8(key);
        const lenDesc = numToDLD(keyBuf.length);
        write(lenDesc);
        write(keyBuf);
        writeTotalLen += lenDesc.byteLength + keyBuf.byteLength;
      }

      if (this.isNoContentData(type)) continue;
      //value
      if (typeof this[type] !== "function") throw new UnsupportedDataTypeError(DataType[type] ?? type);
      writeTotalLen += this[type](data, write);
    }
    if (!ignoreVoid) write(createDataTypeBuf(DataType.void));
    return writeTotalLen + 1;
  }

  [DataType.error](error: Error, write: StreamWriter) {
    const errorMap = { ...error, message: error.message, name: error.name };
    if (error.cause) errorMap.cause = error.cause;
    return this[DataType.map](errorMap, write);
  }
  [key: number]: DataWriter;
}
type StreamWriter = (chunk: Uint8Array) => void;

type DataWriter = (data: any, write: StreamWriter) => number;
function createDataTypeBuf(type: number) {
  const buf = new Uint8Array(1);
  buf[0] = type;
  return buf;
}
