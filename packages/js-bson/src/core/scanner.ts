import { DLD } from "./dynamic_len_data.js";
import { DataType, JsBsonError, ObjectId, UnsupportedDataTypeError, VOID } from "./const.js";
import { strTransf, numTransf } from "./uit_array_util.js";
type StreamReader = (size: number) => Promise<Uint8Array>;
type DataReader = (read: StreamReader) => Promise<unknown>;

export class JBSONScanner {
    /** 如果读取到 void类型, 则返回VOID */
    async readArrayItem(read: StreamReader) {
        const type = (await read(1))[0];
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
        return numTransf.readInt32BE(await read(4));
    }
    async [DataType.bigint](read: StreamReader) {
        return numTransf.readBigInt64BE(await read(8));
    }
    async [DataType.double](read: StreamReader) {
        return numTransf.readDoubleBE(await read(8));
    }

    async [DataType.objectId](read: StreamReader) {
        const data = await DLD.readBigInt(read);
        return new ObjectId(data);
    }

    async [DataType.arrayBuffer](read: StreamReader): Promise<ArrayBuffer> {
        const buffer = await this.uInt8Array(read);
        const arrayBuffer = new ArrayBuffer(buffer.byteLength);
        const view = new Uint8Array(arrayBuffer);
        view.set(buffer);
        return arrayBuffer;
    }
    async [DataType.string](read: StreamReader): Promise<string> {
        const buf = await this.uInt8Array(read);
        return strTransf.readByUtf8(buf);
    }
    async [DataType.symbol](read: StreamReader): Promise<Symbol> {
        const data = await this.readArrayItem(read);
        if (data === VOID) return Symbol();
        else return Symbol(data as string);
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
            const type = (await read(1))[0];
            if (type === DataType.void) break;
            key = (await this[DataType.string](read)) as string;
            if (typeof this[type] !== "function") throw new UnsupportedDataTypeError(DataType[type] ?? type);
            map[key] = await this[type](read);
        }

        return map as any;
    }
    private async uInt8Array(read: StreamReader): Promise<Uint8Array> {
        const len = await DLD.readNumber(read);
        if (len <= 0) return new Uint8Array(0);
        let raw = await read(len);
        if (raw.byteOffset !== 0) {
            const arr = new Uint8Array(len);
            arr.set(raw);
            return arr;
        } else return raw;
    }
    async [DataType.error](read: StreamReader) {
        const { message, cause, ...attr } = await this[DataType.map](read);
        const error = new JsBsonError(message, { cause });
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
/** @public */
export type BsonScanItem = BsonScanArrayValue | BsonScanMapValue | BsonScanValue;
