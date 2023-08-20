import type { Duplex, Readable, Writable } from "node:stream";
import type { ReadableByteStreamController } from "node:stream/web";
import { ReadableStream, WritableStream } from "node:stream/web";

function duplexToWebStream(duplex: Duplex) {
    const read = readableToWebStream(duplex);
    const write = writeableToWebStream(duplex);
    return { read, write };
}
function readableToWebStream(readable: Readable) {
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
function writeableToWebStream(writeable: Writable) {
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
export interface StreamReader {
    (len: number, safe?: false): Promise<Buffer>;
    (len: number, safe: true): Promise<Buffer | null>;
    (len: number, safe?: boolean): Promise<Buffer | null>;
}
