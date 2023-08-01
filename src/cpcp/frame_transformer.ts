import { toDynamicLenData, readDynamicLenData } from "#rt/common/stream_util.js";
import type { StreamReader, StreamWriter } from "#rt/common/stream_util.js";
import { FrameType } from "../cpc_frame.type.js";
import { JSBSON, VOID } from "#rt/common/js_bson.js";

export async function returnRead<T = unknown>(read: StreamReader): Promise<T | undefined> {
    return bsion.readers.readArrayItem(read) as any;
}

export function returnWrite(write: StreamWriter, data?: any, ignoreReturn?: boolean) {
    write(Buffer.from([ignoreReturn ? FrameType.ignoreReturnCall : FrameType.return]));
    return bsion.writers.writeArrayItem(data, write);
}
export async function returnAsyncRead(read: StreamReader) {
    return Number(await readDynamicLenData(read));
}
export function returnAsyncWrite(write: StreamWriter, asyncId: number) {
    write(Buffer.from([FrameType.returnAsync]));
    write(toDynamicLenData(asyncId));
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
    const asyncId = await readDynamicLenData(read);
    const data = await bsion.readers.readArrayItem(read);
    return { asyncId: Number(asyncId), data };
}
export function asyncResultWrite(write: StreamWriter, asyncId: number, data: any, reject?: boolean) {
    const asyncIdBuf = toDynamicLenData(asyncId);
    write(Buffer.from([reject ? FrameType.reject : FrameType.resolve]));
    write(asyncIdBuf);
    bsion.writers.writeArrayItem(data, write);
}

export async function callRead(read: StreamReader) {
    let lenDesc = Number(await readDynamicLenData(read));
    const cmd = (await read(lenDesc)).toString("utf-8");
    const args = await bsion.readArray(read);
    return { cmd, args };
}
export function callWrite(write: StreamWriter, cmd: string, args?: any[], ignoreReturn?: boolean) {
    write(Buffer.from([ignoreReturn ? FrameType.ignoreReturnCall : FrameType.call]));
    const cmdBuf = Buffer.from(cmd);
    write(toDynamicLenData(cmdBuf.byteLength));
    write(cmdBuf);
    bsion.writeArray(args ?? [], write);
}

const bsion = new JSBSON();
