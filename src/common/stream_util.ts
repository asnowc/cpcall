import { Duplex, Readable, Writable } from "node:stream";
import { ReadableStream, WritableStream } from "node:stream/web";
import { ReadableByteStreamController } from "stream/web";

export interface StreamReader {
    (len: number, safe?: false): Promise<Buffer>;
    (len: number, safe: true): Promise<Buffer | null>;
    (len: number, safe?: boolean): Promise<Buffer | null>;
}
export type StreamWriter = (buf: ArrayBufferView) => void;

export async function readDynamicLenData(read: StreamReader): Promise<bigint> {
    let data = 0n;
    do {
        let buf = await read(1);

        let rawData = BigInt(buf.readUint8());
        if (rawData > 0b1111111) {
            data = (data << 7n) + rawData - 0b10000000n;
        } else {
            return (data << 7n) + rawData;
        }
    } while (true);
}

const MAX_INT = 0xfffffff;
const shiftList = (() => {
    let list: (number | bigint)[] = [];
    for (let i = 0; i < 5; i++) list[i] = 2 ** (i * 7);
    for (let i = 5; i < 8; i++) list[i] = BigInt(2 ** (i * 7));
    return list;
})();
export function toDynamicLenData(data: number | bigint): Buffer {
    let buf: number[] = [];
    let uInt!: number;
    let bInt: bigint | undefined;

    //如果number类型大于MAX_INT不转成bigInt,则移位运算符可能运算错误
    if (data > MAX_INT) bInt = BigInt(data);
    else uInt = Number(data);

    let isStart = false;
    let i = 7;
    if (bInt) {
        for (; i > 4; i--) {
            if (bInt >= shiftList[i]) {
                buf[i] = 0b10000000 + Number(bInt >> BigInt(i * 7));
                bInt %= shiftList[i] as bigint;
                isStart = true;
            } else if (isStart) buf[i] = 0b10000000;
        }
        if (bInt > MAX_INT) {
            buf[i] = 0b10000000 + Number(bInt >> BigInt(i * 7));
            uInt = Number(bInt % BigInt(shiftList[i]));
            i--;
        } else uInt = Number(bInt);
    }
    for (; i > 0; i--) {
        if (uInt >= shiftList[i]) {
            buf[i] = 0b10000000 + (uInt >>> (i * 7));
            uInt %= shiftList[i] as number;
            isStart = true;
        } else if (isStart) buf[i] = 0b10000000;
    }
    buf[0] = uInt;

    return Buffer.from(buf.reverse());
}

/** 将 StreamWriter 的值保存到数组 */
export class AllListStreamWriter {
    #byteSize = 0;
    get byteSize() {
        return this.#byteSize;
    }
    private bufList: Buffer[] = [];
    write = (bufView: ArrayBufferView) => {
        if (bufView.byteLength <= 0) return;
        this.#byteSize += bufView.byteLength;
        let buf = Buffer.from(bufView.buffer, bufView.byteOffset, bufView.byteLength);
        this.bufList.push(Buffer.alloc(bufView.byteLength, buf));
    };
    getAll() {
        return Buffer.concat(this.bufList);
    }
}
/** 固定 Buffer 的 StreamReader*/
export function createFixedStreamReader(buffer: Buffer) {
    let offset = 0;
    return async function streamReader(size: number) {
        let end = offset + size;
        if (end > buffer.length) throw new Error("out of range");
        let buf = buffer.subarray(offset, end);
        offset = end;
        return buf;
    };
}

export function duplexToWebStream(duplex: Duplex) {
    const read = readableToWebStream(duplex);
    const write = writeableToWebStream(duplex);
    return { read, write };
}
export function readableToWebStream(readable: Readable) {
    return new ReadableStream(
        {
            type: "bytes",
            start(ctrl: ReadableByteStreamController) {
                readable.on("readable", () => {
                    let size = ctrl.desiredSize ?? undefined;
                    if (readable.readableLength > 0 && (size === undefined || size > 0)) {
                        ctrl.enqueue(readable.read(size));
                    }
                });
            },
            cancel(reason: any) {
                readable.destroy(reason);
            },
        },
        { highWaterMark: readable.readableHighWaterMark }
    );
}
export function writeableToWebStream(writeable: Writable) {
    return new WritableStream(
        {
            abort(reason: any) {
                writeable.destroy(reason);
            },
            close() {
                writeable.end();
            },
            write(chunk: any, ctrl) {
                writeable.write(chunk, (e) => {
                    if (e) ctrl.error(e);
                });
            },
        },
        { highWaterMark: writeable.writableHighWaterMark }
    );
}

export function createReaderFromReadable(readable: Readable): StreamReader {
    if (Object.hasOwn(readable, asyncStreamReadSymbol)) throw new Error("The stream has been controlled");
    (readable as any)[asyncStreamReadSymbol] = true;

    let cacheTotal = 0;
    let cache: Buffer[] = [];
    let iterable: AsyncIterableIterator<Buffer> = readable[Symbol.asyncIterator]();
    let reading = false;

    async function read(size: number): Promise<Buffer>;
    async function read(size: number, safe: true): Promise<Buffer | null>;
    async function read(size: number, safe?: boolean): Promise<Buffer | null> {
        if (reading) throw new Error("不能连续读取");

        reading = true;
        do {
            if (cacheTotal > size) {
                cacheTotal -= size;
                reading = false;
                return concatBufferList(size, cache);
            } else if (cacheTotal === size) {
                let buf = cache.length === 1 ? cache[0] : Buffer.concat(cache);
                cache = [];
                cacheTotal = 0;
                reading = false;
                return buf;
            }

            const { value, done } = await iterable.next();
            if (done) break;
            cache.push(value);
            cacheTotal += value.byteLength;
        } while (true);

        cache = [];
        cacheTotal = 0;
        reading = false;
        if (safe) return null;
        else throw new Error("Stream is ended");
    }

    return read;
}

const asyncStreamReadSymbol = Symbol("asyncStreamRead");
/**
 * 从 bufList读取 size 长度的 Buffer,
 * bufList 中已读取的部分会被移除
 * 如果bufList中的buffer总长度小于size，则用0填充
 */
function concatBufferList(size: number, bufList: Buffer[]) {
    const buf = Buffer.allocUnsafe(size);
    let offset = 0;
    for (let i = 0; i < bufList.length; i++) {
        let chunk = bufList[i];
        let overlength = size - offset;
        if (overlength < chunk.byteLength) {
            buf.set(chunk.subarray(0, overlength));
            bufList[i] = chunk.subarray(overlength);
            bufList.splice(0, i - 1);
            return buf;
        } else if (overlength === chunk.byteLength) {
            buf.set(chunk, offset);
            bufList.splice(0, i);
            return buf;
        }
    }
    while (offset < size) buf[offset++] = 0;
    return buf;
}
