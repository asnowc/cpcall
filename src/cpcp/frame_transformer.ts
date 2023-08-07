import { numToDLD, DLD } from "#rt/common/stream_util.js";
import type { StreamReader, StreamWriter } from "#rt/common/stream_util.js";
import { FrameType } from "../cpc/cpc_frame.type.js";
import {
    JBSONWriter,
    BsonScanItem,
    DataType,
    JBSONScanner,
    UnsupportedDataTypeError,
    VOID,
} from "#rt/common/js_bson.js";

export async function returnRead<T = unknown>(read: StreamReader): Promise<T | undefined> {
    return bsion.readers.readArrayItem(read) as any;
}

export function returnWrite(write: StreamWriter, data?: any, ignoreReturn?: boolean) {
    write(Buffer.from([ignoreReturn ? FrameType.ignoreReturnCall : FrameType.return]));
    return bsion.writers.writeArrayItem(data, write);
}
export async function returnAsyncRead(read: StreamReader) {
    return await DLD.readNumber(read);
}
export function returnAsyncWrite(write: StreamWriter, asyncId: number) {
    write(Buffer.from([FrameType.returnAsync]));
    write(numToDLD(asyncId));
}
export async function throwRead(read: StreamReader) {
    let err = await bsion.readers.readArrayItem(read);
    const isNoExist = err === VOID;
    return { data: isNoExist ? undefined : err, isNoExist };
}
export function throwWrite(write: StreamWriter, data?: any, isNoExist?: boolean) {
    write(Buffer.from([FrameType.throw]));
    bsion.writers.writeArrayItem(isNoExist ? VOID : data, write);
}

export async function asyncResultRead(read: StreamReader) {
    const asyncId = await DLD.readNumber(read);
    const data = await bsion.readers.readArrayItem(read);
    return { asyncId: Number(asyncId), data };
}
export function asyncResultWrite(write: StreamWriter, asyncId: number, data: any, reject?: boolean) {
    const asyncIdBuf = numToDLD(asyncId);
    write(Buffer.from([reject ? FrameType.reject : FrameType.resolve]));
    write(asyncIdBuf);
    bsion.writers.writeArrayItem(data, write);
}

export async function callRead(read: StreamReader) {
    let lenDesc = await DLD.readNumber(read);
    const cmd = (await read(lenDesc)).toString("utf-8");
    const args = await bsion.readArray(read);
    return { cmd, args };
}
export function callWrite(write: StreamWriter, cmd: string, args?: any[], ignoreReturn?: boolean) {
    write(Buffer.from([ignoreReturn ? FrameType.ignoreReturnCall : FrameType.call]));
    const cmdBuf = Buffer.from(cmd);
    write(numToDLD(cmdBuf.byteLength));
    write(cmdBuf);
    bsion.writeArray(args ?? [], write);
}

export async function execRead(read: StreamReader) {
    const cmd = await DLD.readNumber(read);
    const args = await bsion.readArray(read);
    return { cmd, args };
}
export async function execWrite(write: StreamWriter, cmd: number, args?: any[], ignoreReturn?: boolean) {
    write(Buffer.from([ignoreReturn ? FrameType.ignoreReturnExec : FrameType.exec]));
    write(numToDLD(cmd));
    bsion.writeArray(args ?? [], write);
}

export class JSBSON {
    readonly readers;
    readonly writers;
    constructor(writer?: JBSONWriter, reader?: JBSONScanner) {
        this.readers = reader ?? new JBSONScanner();
        this.writers = writer ?? new JBSONWriter();
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
const bsion = new JSBSON();
