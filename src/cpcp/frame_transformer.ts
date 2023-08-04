import { numToDLD, readNumberDLD } from "#rt/common/stream_util.js";
import type { StreamReader, StreamWriter } from "#rt/common/stream_util.js";
import { FrameType } from "../cpc_frame.type.js";
import { ReactionController } from "../cpc/reaction.js";
import { JSBSON, VOID, DataType, BSONReaders, BSONWriters } from "#rt/common/js_bson.js";
enum CustomDataType {
    reaction = 255,
}

export async function returnRead<T = unknown>(read: StreamReader): Promise<T | undefined> {
    return bsion.readers.readArrayItem(read) as any;
}

export function returnWrite(write: StreamWriter, data?: any, ignoreReturn?: boolean) {
    write(Buffer.from([ignoreReturn ? FrameType.ignoreReturnCall : FrameType.return]));
    return bsion.writers.writeArrayItem(data, write);
}
export async function returnAsyncRead(read: StreamReader) {
    return Number(await readNumberDLD(read));
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
    const asyncId = await readNumberDLD(read);
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
    let lenDesc = Number(await readNumberDLD(read));
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
class CustomReaders extends BSONReaders {
    async [CustomDataType.reaction](read: StreamReader) {
        const initData = await this[DataType.map](read);
        return ReactionController.create(initData);
    }
}
CustomReaders.prototype[CustomDataType.reaction] = BSONReaders.prototype[DataType.map];

class CustomWriters extends BSONWriters {
    toType(data: any): number {
        const type = super.toType(data);
        if (type === DataType.map && ReactionController.isReaction(data)) return CustomDataType.reaction;
        return type;
    }
}
CustomWriters.prototype[CustomDataType.reaction] = BSONWriters.prototype[DataType.map];

const bsion = new JSBSON(new CustomWriters(), new CustomReaders());
