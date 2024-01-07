import { DLD } from "../dynamic_len_data.js";
import { DataType, JsBsonError, ObjectId, UnsupportedDataTypeError, VOID } from "../const.js";
import { numTransf, strTransf } from "../uint_array_util/mod.js";

export class JBSONReader {
  /** 如果读取到 void类型, 则返回VOID */
  readArrayItem(read: Uint8Array, offset: number): [any, number] {
    const type = read[offset];
    if (type === DataType.void) return [VOID, 1];
    if (typeof this[type] !== "function") throw new UnsupportedDataTypeError(DataType[type] ?? type);
    const data = this[type](read, offset + 1);
    data[1]++;
    return data;
  }
  private uInt8Array(buf: Uint8Array, offset: number): [Uint8Array, number] {
    const [lenDesc, len] = DLD.readNumberSync(buf, offset);
    if (lenDesc <= 0) return [new Uint8Array(0), len];
    offset += len;
    return [buf.subarray(offset, lenDesc + offset), len + lenDesc];
  }

  [DataType.undefined](): [undefined, number] {
    return [undefined, 0];
  }
  [DataType.null](): [null, number] {
    return [null, 0];
  }
  [DataType.true](): [true, number] {
    return [true, 0];
  }
  [DataType.false](): [false, number] {
    return [false, 0];
  }

  [DataType.int](read: Uint8Array, offset: number): [number, number] {
    return [numTransf.readInt32BE(read, offset), 4];
  }
  [DataType.bigint](read: Uint8Array, offset: number): [bigint, number] {
    return [numTransf.readBigInt64BE(read, offset), 8];
  }
  [DataType.double](buf: Uint8Array, offset: number): [number, number] {
    return [numTransf.readDoubleBE(buf, offset), 8];
  }

  [DataType.objectId](buf: Uint8Array, offset: number): [ObjectId, number] {
    const data = DLD.readBigIntSync(buf, offset);
    (data as any)[0] = new ObjectId(data[0]);
    return data as any;
  }

  [DataType.arrayBuffer](buf: Uint8Array, offset: number): [ArrayBuffer, number] {
    const [lenDesc, len] = DLD.readNumberSync(buf, offset);
    if (lenDesc <= 0) return [new ArrayBuffer(0), len];
    offset += len;
    const arrayBuffer = new ArrayBuffer(lenDesc);
    const view = new Uint8Array(arrayBuffer);
    view.set(buf.subarray(offset, offset + lenDesc));

    return [arrayBuffer, len + lenDesc];
  }
  [DataType.string](buf: Uint8Array, offset: number): [string, number] {
    const [buffer, len] = this.uInt8Array(buf, offset);
    return [strTransf.readByUtf8(buffer), len];
  }
  [DataType.symbol](buf: Uint8Array, offset: number): [Symbol, number] {
    const data = this.readArrayItem(buf, offset);
    if (data[0] === VOID) data[0] = Symbol();
    else {
      data[0] = Symbol(data[0]);
    }
    return data;
  }
  [DataType.regExp](buf: Uint8Array, offset: number): [RegExp, number] {
    const data = this[DataType.string](buf, offset);
    data[0] = new RegExp(data[0]) as any;
    return data as any;
  }
  [DataType.array](buf: Uint8Array, offset: number): [any[], number] {
    let arrayList: unknown[] = [];
    const start = offset;
    while (offset < buf.byteLength) {
      let [value, len] = this.readArrayItem(buf, offset);
      offset += len;
      if (value === VOID) break;
      arrayList.push(value);
    }
    return [arrayList, offset - start];
  }
  [DataType.map](buf: Uint8Array, offset: number): [object, number] {
    const map: Record<string, unknown> = {};
    let key: string;
    const start = offset;
    while (offset < buf.byteLength) {
      const type = buf[offset++];
      if (type === DataType.void) break;
      let data = this[DataType.string](buf, offset);
      key = data[0];
      offset += data[1];

      if (typeof this[type] !== "function") throw new UnsupportedDataTypeError(DataType[type] ?? type);
      data = this[type](buf, offset);
      map[key] = data[0];
      offset += data[1];
    }

    return [map, offset - start];
  }

  [DataType.error](buf: Uint8Array, offset: number): [Error, number] {
    let [{ message, cause, ...attr }, len] = this[DataType.map](buf, offset) as [Error, number];
    const error = new JsBsonError(message, { cause });
    Object.assign(error, attr);
    return [error, len];
  }
  [key: number]: (buf: Uint8Array, offset: number) => [any, number];
}
