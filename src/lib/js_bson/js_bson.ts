import type { StreamReader, StreamWriter } from "../stream_util.js";
import { DataType, UnsupportedDataTypeError, VOID } from "./bson.type.js";
import { BsonScanItem, JBSONScanner } from "./scanner.js";
import { JBSONReader, JBSONWriter } from "./transformer.js";
export * from "./scanner.js";
export * from "./transformer.js";

const syncReader = new JBSONReader();
const jbsonScanner = new JBSONScanner();

async function* scanDataType(read: StreamReader) {
    do {
        const type = (await read(1)).readUint8();
        if (type === DataType.void) return;
        yield type;
    } while (true);
}
async function* scanArray(read: StreamReader): AsyncGenerator<BsonScanItem, void, void> {
    let key = 0;
    for await (const type of scanDataType(read)) {
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
    for await (const type of scanDataType(read)) {
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

export const JBSON = {
    toArray<T = unknown>(buffer: Buffer, offset: number = 0): T[] {
        if (!Buffer.isBuffer(buffer)) throw new Error("第一个参数应该是Buffer类型");

        return syncReader[DataType.array](buffer, offset)[0];
    },
    toMap<T = Record<string, unknown>>(buffer: Buffer, offset = 0): T {
        if (!Buffer.isBuffer(buffer)) throw new Error("第一个参数应该是Buffer类型");

        return syncReader[DataType.map](buffer, offset)[0] as T;
    },
    /**
     * 读取一个Array项
     */
    toArrayItem<T = unknown>(buffer: Buffer, offset: number = 0): [T, number] {
        if (!Buffer.isBuffer(buffer)) throw new Error("第一个参数应该是Buffer类型");
        return syncReader.readArrayItem(buffer, offset);
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

/**
 * @description 将对象转为 array 类型的 JBSON. 顶层不写入类型
 * @param ignoreVoid 如果为true, 则在Array结束位置忽略写入Void类型(仅在顶层忽略写入)
 */
export function toArrayJBSON(arr: any[], ignoreVoid?: boolean) {
    const bufferList: Buffer[] = [];
    let totalSize = 0;
    const write: StreamWriter = function (data: Buffer) {
        bufferList.push(data);
        totalSize += data.byteLength;
    };
    writer[DataType.array](arr, write, ignoreVoid);
    return Buffer.concat(bufferList);
}
/**
 * @description 将对象类型转为 map 类型的 JBSON. 顶层不写入类型
 * @param ignoreVoid 如果为true, 则在Map结束位置忽略写入Void类型(仅在顶层忽略写入)
 */
export function toMapJBSON(arr: object, ignoreVoid?: boolean) {
    const bufferList: Buffer[] = [];
    let totalSize = 0;
    const write: StreamWriter = function (data: Buffer) {
        bufferList.push(data);
        totalSize += data.byteLength;
    };
    writer[DataType.map](arr, write, ignoreVoid);
    return Buffer.concat(bufferList);
}
/**
 * 转为Array项
 */
export function toArrayItemJBSON(data: any) {
    const bufferList: Buffer[] = [];
    let totalSize = 0;
    const write: StreamWriter = function (data: Buffer) {
        bufferList.push(data);
        totalSize += data.byteLength;
    };
    writer.writeArrayItem(data, write);

    return Buffer.concat(bufferList);
}
