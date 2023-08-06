import type { StreamReader, StreamWriter } from "../stream_util.js";
import { DataType, UnsupportedDataTypeError } from "./bson.type.js";
import { BsonScanItem, JBSONScanner } from "./scanner.js";
import { JBSONReader, JBSONWriter } from "./transformer.js";
export * from "./scanner.js";
export * from "./transformer.js";

const syncReader = new JBSONReader();
const jbsonScanner = new JBSONScanner();

async function* readDataType(read: StreamReader) {
    do {
        const type = (await read(1)).readUint8();
        if (type === DataType.void) return;
        yield type;
    } while (true);
}
async function* scanArray(read: StreamReader): AsyncGenerator<BsonScanItem, void, void> {
    let key = 0;
    for await (const type of readDataType(read)) {
        let value: unknown;
        let isIterator = true;
        if (type === DataType.array) value = scanArray(read);
        else if (type === DataType.map) value = scanMap(read);
        else if (typeof jbsonScanner[type] !== "function") throw new UnsupportedDataTypeError(DataType[type] ?? type);
        else {
            value = await jbsonScanner[type](read);
            isIterator = false;
        }
        yield { dataType: type, key, value, isIterator } as BsonScanItem;
        key++;
    }
}
async function* scanMap(read: StreamReader): AsyncGenerator<BsonScanItem, void, void> {
    const map: Record<string, unknown> = {};
    let key: string;
    for await (const type of readDataType(read)) {
        key = (await jbsonScanner[DataType.string](read)) as string;

        let value: any;
        let isIterator = true;
        if (type === DataType.array) value = scanArray(read);
        else if (type === DataType.map) value = scanMap(read);
        else if (typeof jbsonScanner[type] !== "function") throw new UnsupportedDataTypeError(DataType[type] ?? type);
        else {
            value = await jbsonScanner[type](read);
            isIterator = false;
        }

        map[key] = value;

        yield { key, dataType: type, value, isIterator } as BsonScanItem;
    }

    return map as any;
}

type BSONData = Buffer | ArrayBufferView | ArrayBuffer;

export const JBSON = {
    toArray<T = unknown[]>(buffer: BSONData, offset = 0): T {
        if (buffer instanceof ArrayBuffer) buffer = Buffer.from(buffer);
        else if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer.buffer);

        return syncReader[DataType.array](buffer as Buffer, offset)[0] as any;
    },
    toMap<T = Record<string, unknown>>(buffer: BSONData, offset = 0): T {
        if (buffer instanceof ArrayBuffer) buffer = Buffer.from(buffer);
        else if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer.buffer);

        return syncReader[DataType.map](buffer as Buffer, offset)[0] as any;
    },

    scanArray,
    scanMap,

    readArray<T = unknown>(read: StreamReader): Promise<T[]> {
        return jbsonScanner[DataType.array](read) as any;
    },
    readMap<T = unknown>(read: StreamReader): Promise<T> {
        return jbsonScanner[DataType.map](read) as any;
    },
};

const writer = new JBSONWriter();

export function toArrayJBSON(arr: any[]) {
    const bufferList: Buffer[] = [];
    let totalSize = 0;
    const write: StreamWriter = function (data: Buffer) {
        bufferList.push(data);
        totalSize += data.byteLength;
    };
    writer[DataType.array](arr, write);
    return Buffer.concat(bufferList);
}
export function toMapJBSON(arr: object) {
    const bufferList: Buffer[] = [];
    let totalSize = 0;
    const write: StreamWriter = function (data: Buffer) {
        bufferList.push(data);
        totalSize += data.byteLength;
    };
    writer[DataType.map](arr, write);
    return Buffer.concat(bufferList);
}
