import { numToDLD, DLD } from "../dynamic_len_data.js";
import { DataType, ObjectId, UnsupportedDataTypeError, VOID } from "./bson.type.js";
import { numTransf, strTransf } from "./uit_array_util.js";

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
        const error = new Error(message, { cause });
        Object.assign(error, attr);
        return [error, len];
    }
    [key: number]: (buf: Uint8Array, offset: number) => [any, number];
}

type DataWriter = (data: any, write: StreamWriter) => number;
export class JBSONWriter {
    isNoContentData(type: number) {
        return (
            type === DataType.true || type === DataType.false || type === DataType.null || type === DataType.undefined
        );
    }
    toType(data: any): number {
        if (data === true) return DataType.true;
        else if (data === false) return DataType.false;
        else if (data === undefined) return DataType.undefined;
        else if (data === null) return DataType.null;

        let type: number;
        switch (typeof data) {
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
            case "object":
                if (Array.isArray(data)) type = DataType.array;
                else if (data instanceof ArrayBuffer) type = DataType.arrayBuffer;
                else if (data instanceof RegExp) type = DataType.regExp;
                else if (data instanceof Error) type = DataType.error;
                else if (data instanceof ObjectId) type = DataType.objectId;
                else type = DataType.map;
                break;
            default:
                throw new UnsupportedDataTypeError(typeof data);
        }
        return type;
    }

    /** 支持写入void类型 */
    writeArrayItem(data: unknown, write: StreamWriter): number {
        if (data === VOID) {
            write(createDataTypeBuf(DataType.void));
            return 1;
        }
        const type = this.toType(data);
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
        write(numToDLD(data.byteLength));
        write(new Uint8Array(data));
        return data.byteLength;
    }
    [DataType.string](data: string, write: StreamWriter) {
        return this[DataType.arrayBuffer](strTransf.writeByUtf8(data), write);
    }

    [DataType.regExp](data: RegExp, write: StreamWriter) {
        return this[DataType.string](data.source, write);
    }

    [DataType.array](array: unknown[], write: StreamWriter, ignoreVoid?: boolean): number {
        let writeTotalLen = 0;
        for (let i = 0; i < array.length; i++) {
            writeTotalLen += this.writeArrayItem(array[i], write);
        }
        if (!ignoreVoid) write(createDataTypeBuf(DataType.void));
        return writeTotalLen + 1;
    }
    [DataType.map](map: Record<string, any>, write: StreamWriter, ignoreVoid?: boolean): number {
        let writeTotalLen = 0;
        for (const [key, data] of Object.entries(map)) {
            const type = this.toType(data);
            {
                //type
                const typeBuf = createDataTypeBuf(type);
                if (!typeBuf) throw new UnsupportedDataTypeError(type);
                write(typeBuf);
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
function createDataTypeBuf(type: number) {
    const buf = new Uint8Array(1);
    buf[0] = type;
    return buf;
}

type StreamWriter = (chunk: Uint8Array) => void;
