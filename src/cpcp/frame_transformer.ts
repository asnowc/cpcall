import { toDynamicLenData, readDynamicLenData } from "#rt/common/stream_util.js";
import type { StreamReader, StreamWriter } from "#rt/common/stream_util.js";
import { FrameType } from "../cpc_frame.type.js";
import { JsBSON, VOID } from "#rt/common/js_bson.js";

const jsBSON = new JsBSON();

export async function returnRead<T = unknown>(read: StreamReader): Promise<T | undefined> {
    let val = await jsBSON.readArrayItem<T>(read);
    return val === VOID ? undefined : val;
}
export function returnWrite(write: StreamWriter, data?: any, ignoreReturn?: boolean) {
    write(Buffer.from([ignoreReturn ? FrameType.ignoreReturnCall : FrameType.return]));
    return jsBSON.writeArrayItem(data === undefined ? VOID : data, write);
}
export async function returnAsyncRead(read: StreamReader) {
    return Number(await readDynamicLenData(read));
}
export function returnAsyncWrite(write: StreamWriter, asyncId: number) {
    write(Buffer.from([FrameType.returnAsync]));
    write(toDynamicLenData(asyncId));
}
export async function throwRead(read: StreamReader) {
    let err = await jsBSON.readArrayItem(read);
    const isNoExist = err === VOID;
    return { data: isNoExist ? undefined : err, isNoExist };
}
export function throwWrite(write: StreamWriter, data?: any, isNoExist?: boolean) {
    write(Buffer.from([FrameType.throw]));

    jsBSON.writeArrayItem(isNoExist ? VOID : data, write);
}

export async function asyncResultRead(read: StreamReader) {
    const asyncId = await readDynamicLenData(read);
    const data = await jsBSON.readArrayItem(read);
    return { asyncId: Number(asyncId), data };
}
export function asyncResultWrite(write: StreamWriter, asyncId: number, data: any, reject?: boolean) {
    const asyncIdBuf = toDynamicLenData(asyncId);
    write(Buffer.from([reject ? FrameType.reject : FrameType.resolve]));
    write(asyncIdBuf);
    jsBSON.writeArrayItem(data, write);
}

export async function callRead(read: StreamReader) {
    let lenDesc = Number(await readDynamicLenData(read));
    const cmd = (await read(lenDesc)).toString("utf-8");
    const args = await jsBSON.readArray(read);
    return { cmd, args };
}
export function callWrite(write: StreamWriter, cmd: string, args?: any[], ignoreReturn?: boolean) {
    write(Buffer.from([ignoreReturn ? FrameType.ignoreReturnCall : FrameType.call]));
    const cmdBuf = Buffer.from(cmd);
    write(toDynamicLenData(cmdBuf.byteLength));
    write(cmdBuf);
    jsBSON.writeArray(args ?? [], write);
}
