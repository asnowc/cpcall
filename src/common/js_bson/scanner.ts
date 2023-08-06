import { readNumberDLD } from "../stream_util.js";
import type { StreamReader } from "../stream_util.js";
import { DataType, ObjectId, UnsupportedDataTypeError, VOID } from "./bson.type.js";

type DataReader = (read: StreamReader) => Promise<unknown>;

export class JBSONScanner {
    /** 如果读取到 void类型, 则返回VOID */
    async readArrayItem(read: StreamReader) {
        const type = (await read(1)).readUint8();
        if (type === DataType.void) return VOID;
        if (typeof this[type] !== "function") throw new UnsupportedDataTypeError(DataType[type] ?? type);
        return this[type](read);
    }

    async [DataType.undefined]() {
        return undefined;
    }
    async [DataType.null]() {
        return null;
    }
    async [DataType.true]() {
        return true;
    }
    async [DataType.false]() {
        return false;
    }

    async [DataType.int](read: StreamReader) {
        return (await read(4)).readInt32BE();
    }
    async [DataType.bigint](read: StreamReader) {
        return (await read(8)).readBigInt64BE();
    }
    async [DataType.double](read: StreamReader) {
        return (await read(8)).readDoubleBE();
    }

    async [DataType.objectId](read: StreamReader) {
        const data = await readNumberDLD(read);
        return new ObjectId(data);
    }

    async [DataType.arrayBuffer](read: StreamReader): Promise<ArrayBuffer> {
        const buffer = await this[DataType.buffer](read);
        const arrayBuffer = new ArrayBuffer(buffer.byteLength);
        const view = Buffer.from(arrayBuffer);
        view.set(buffer);
        return arrayBuffer;
    }
    async [DataType.string](read: StreamReader): Promise<string> {
        const buf = await this[DataType.buffer](read);
        return buf.toString("utf-8");
    }

    async [DataType.regExp](read: StreamReader) {
        const str = await this[DataType.string](read);
        return RegExp(str);
    }
    async [DataType.array](read: StreamReader) {
        let arrayList: unknown[] = [];
        while (true) {
            let value = await this.readArrayItem(read);
            if (value === VOID) break;
            arrayList.push(value);
        }
        return arrayList;
    }
    async [DataType.map](read: StreamReader) {
        const map: Record<string, unknown> = {};
        let key: string;
        while (true) {
            const type = (await read(1)).readUint8();
            if (type === DataType.void) break;
            key = (await this[DataType.string](read)) as string;
            if (typeof this[type] !== "function") throw new UnsupportedDataTypeError(DataType[type] ?? type);
            map[key] = await this[type](read);
        }

        return map as any;
    }
    async [DataType.buffer](read: StreamReader) {
        const len = await readNumberDLD(read);
        if (len <= 0) return Buffer.alloc(0);
        return read(Number(len));
    }
    async [DataType.error](read: StreamReader) {
        const { message, cause, ...attr } = await this[DataType.map](read);
        const error = new Error(message, { cause });
        Object.assign(error, attr);
        return error;
    }
    [key: number]: DataReader;
}

interface BsonScanValue<V = unknown> {
    dataType: number;
    key: string | number;
    value: V;
    isIterator: false;
}
interface BsonScanArrayValue {
    dataType: DataType.array;
    key: number;
    value: AsyncGenerator<BsonScanItem, void, void>;
    isIterator: true;
}
interface BsonScanMapValue {
    dataType: DataType.map;
    key: string;
    value: AsyncGenerator<BsonScanItem, void, void>;
    isIterator: true;
}
export type BsonScanItem = BsonScanArrayValue | BsonScanMapValue | BsonScanValue;
