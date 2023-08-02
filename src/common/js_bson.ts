import { numToDLD, readNumberDLD, DLD_MAX_LEN } from "#rt/common/stream_util.js";
import type { StreamReader, StreamWriter } from "#rt/common/stream_util.js";

export enum DataType {
    void = 0,
    null = 1,
    undefined = 2,
    true = 3,
    false = 4,
    int = 5,
    bigint = 6,
    double = 7,

    objectId = 8,

    arrayBuffer = 9,
    string = 10,
    regExp = 11,
    /** @deprecated 暂不支持*/
    function = 12,
    array = 13,
    map = 14,
    buffer = 15,

    error = 16,
}

type DataReader = (read: StreamReader) => Promise<unknown>;
type DataWriter = (data: any, write: StreamWriter) => number;

export class BSONReaders {
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
export class BSONWriters {
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
                else if (data instanceof Buffer) type = DataType.buffer;
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
            write(Buffer.from([DataType.void]));
            return 1;
        }
        const type = this.toType(data);
        //type
        const typeBuf = Buffer.from([type]);
        if (!typeBuf) throw new UnsupportedDataTypeError(type);
        write(typeBuf);
        if (this.isNoContentData(type)) return 1;

        if (typeof this[type] !== "function") throw new UnsupportedDataTypeError(DataType[type] ?? type);
        return this[type](data, write);
    }
    [DataType.int](data: number, write: StreamWriter) {
        let buf = Buffer.allocUnsafe(4);
        buf.writeInt32BE(data);
        write(buf);
        return 4;
    }
    [DataType.bigint](data: bigint, write: StreamWriter) {
        let buf = Buffer.allocUnsafe(8);
        buf.writeBigInt64BE(data);
        write(buf);
        return 8;
    }
    [DataType.double](data: number, write: StreamWriter) {
        let buf = Buffer.allocUnsafe(8);
        buf.writeDoubleBE(data);
        write(buf);
        return 8;
    }

    [DataType.objectId](data: ObjectId, write: StreamWriter) {
        const buf = data.toBuffer();
        write(buf);
        return buf.byteLength;
    }
    [DataType.arrayBuffer](data: ArrayBufferLike, write: StreamWriter) {
        write(numToDLD(data.byteLength));
        write(Buffer.from(data));
        return data.byteLength;
    }
    [DataType.string](data: string, write: StreamWriter) {
        return this[DataType.buffer](Buffer.from(data, "utf-8"), write);
    }

    [DataType.regExp](data: RegExp, write: StreamWriter) {
        return this[DataType.string](data.source, write);
    }

    [DataType.array](array: unknown[], write: StreamWriter): number {
        let writeTotalLen = 0;
        for (let i = 0; i < array.length; i++) {
            writeTotalLen += this.writeArrayItem(array[i], write);
        }
        write(Buffer.from([DataType.void]));
        return writeTotalLen + 1;
    }
    [DataType.map](map: Record<string, any>, write: StreamWriter): number {
        let writeTotalLen = 0;
        for (const [key, data] of Object.entries(map)) {
            const type = this.toType(data);
            {
                //type
                const typeBuf = Buffer.from([type]);
                if (!typeBuf) throw new UnsupportedDataTypeError(type);
                write(typeBuf);
                writeTotalLen++;

                ///key
                const keyBuf = Buffer.from(key);
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
        write(Buffer.from([DataType.void]));
        return writeTotalLen + 1;
    }
    [DataType.buffer](data: Buffer, write: StreamWriter) {
        write(numToDLD(data.byteLength));
        write(data as Buffer);
        return data.byteLength;
    }
    [DataType.error](error: Error, write: StreamWriter) {
        const errorMap = { ...error, message: error.message, name: error.name };
        if (error.cause) errorMap.cause = error.cause;
        return this[DataType.map](errorMap, write);
    }
    [key: number]: DataWriter;
}

export class JSBSON {
    readonly readers;
    readonly writers;
    constructor(writer?: BSONWriters, reader?: BSONReaders) {
        this.readers = reader ?? new BSONReaders();
        this.writers = writer ?? new BSONWriters();
    }

    private async *readDataType(read: StreamReader) {
        do {
            const type = (await read(1)).readUint8();
            if (type === DataType.void) return;
            yield type;
        } while (true);
    }
    readArray<T = unknown>(read: StreamReader): Promise<T[]> {
        return this.readers[DataType.array](read) as any;
    }
    readMap<T = unknown>(read: StreamReader): Promise<T> {
        return this.readers[DataType.map](read) as any;
    }
    async *scanArray(read: StreamReader): AsyncGenerator<BsonScanItem, void, void> {
        let key = 0;
        for await (const type of this.readDataType(read)) {
            let value: unknown;
            let isIterator = true;
            if (type === DataType.array) value = this.scanArray(read);
            else if (type === DataType.map) value = this.scanMap(read);
            else if (typeof this.readers[type] !== "function")
                throw new UnsupportedDataTypeError(DataType[type] ?? type);
            else {
                value = await this.readers[type](read);
                isIterator = false;
            }
            yield { dataType: type, key, value, isIterator } as BsonScanItem;
            key++;
        }
    }
    async *scanMap(read: StreamReader): AsyncGenerator<BsonScanItem, void, void> {
        const map: Record<string, unknown> = {};
        let key: string;
        for await (const type of this.readDataType(read)) {
            key = (await this.readers[DataType.string](read)) as string;

            let value: any;
            let isIterator = true;
            if (type === DataType.array) value = this.scanArray(read);
            else if (type === DataType.map) value = this.scanMap(read);
            else if (typeof this.readers[type] !== "function")
                throw new UnsupportedDataTypeError(DataType[type] ?? type);
            else {
                value = await this.readers[type](read);
                isIterator = false;
            }

            map[key] = value;

            yield { key, dataType: type, value, isIterator } as BsonScanItem;
        }

        return map as any;
    }
    writeArray(array: unknown[], write: StreamWriter): number {
        return this.writers[DataType.array](array, write);
    }
    writeMap(map: Record<string, any>, write: StreamWriter): number {
        return this.writers[DataType.map](map, write);
    }
}
export const VOID = Symbol("void");
export async function getAsyncGeneratorReturn<T>(itr: AsyncGenerator<unknown, T, void>): Promise<T> {
    let res = await itr.next();
    while (!res.done) res = await itr.next();
    return res.value as any;
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

export class ObjectId {
    #value: bigint;
    get value() {
        return this.#value;
    }
    constructor(value: bigint | number) {
        if (value > DLD_MAX_LEN) throw new Error("Exceeds the maximum number");
        else if (value < 0) throw new Error("The number cannot be negative");
        if (typeof value === "number") {
            if (value % 1 !== 0) throw new Error("Id must be an integer");
            this.#value = BigInt(value);
        } else this.#value = value;
    }
    valueOf(): bigint {
        return this.#value;
    }
    toString() {
        return this.#value.toString();
    }
    toBuffer(): Buffer {
        return numToDLD(this.#value);
    }
}

export class UnsupportedDataTypeError extends Error {
    constructor(desc?: string | number) {
        super("Unsupported data type: " + desc);
    }
}
