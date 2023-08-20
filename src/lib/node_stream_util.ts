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
    readable.pause();

    type WaitReaderHandle = {
        resolve(buf: Buffer | null): void;
        reject(reason?: any): void;
        size: number;
        safe?: boolean;
    };

    let cacheTotal = 0;
    let cache: Buffer[] = [];
    let handles: WaitReaderHandle[] = [];
    let ended = false;

    function read(size: number): Promise<Buffer>;
    function read(size: number, safe: boolean): Promise<Buffer | null>;
    function read(size: number, safe?: boolean) {
        if (size <= 0) throw new Error("size must be greater than 0");
        return new Promise<Buffer | null>(function (resolve, reject) {
            if (handles.length === 0) {
                if (cacheTotal >= size) {
                    const buf = concatBufferList(size, cache);
                    cacheTotal -= size;
                    resolve(buf);
                    return;
                } else if (ended) {
                    if (safe) resolve(null);
                    else reject(new Error("Stream is ended"));
                    return;
                }
            }
            handles.push({ resolve, reject, size, safe: Boolean(safe) });
        });
    }

    function onReadable() {
        if (handles.length <= 0) return;
        const chunk: Buffer = readable.read();
        if (!Buffer.isBuffer(chunk)) return;

        cache.push(chunk);
        cacheTotal += chunk.byteLength;
        while (handles[0] && cacheTotal >= handles[0].size) {
            const item = handles.shift()!;
            const buf = concatBufferList(item.size, cache);
            cacheTotal -= item.size;
            item.resolve(buf);
        }
    }
    function onEnd() {
        ended = true;

        readable.off("readable", onReadable);
        readable.off("end", onEnd);
        readable.off("close", onEnd);

        for (let i = 0; i < handles.length; i++) {
            if (handles[i].safe) handles[i].resolve(null);
            else handles[i].reject(new Error("Stream is ended"));
        }
        handles = [];
    }
    if (!readable.readableEnded) {
        readable.on("readable", onReadable);
        readable.on("end", onEnd);
        readable.on("close", onEnd);
    } else ended = true;
    function cancel(): null | Buffer {
        onEnd();
        if (cache.length) {
            const buf = Buffer.concat(cache);
            cache = [];
            return buf;
        }
        return null;
    }
    read.cancel = cancel;

    return read;
}
const asyncStreamReadSymbol = Symbol("asyncStreamRead");
/**
 * 从 bufList读取 size 长度的 Buffer,
 * bufList 中已读取的部分会被移除
 * 如果bufList中的buffer总长度小于size，则用0填充
 */
function concatBufferList(size: number, bufList: Buffer[]) {
    if (size === bufList[0].byteLength) return bufList.shift()!;

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
        } else {
            buf.set(chunk, offset);
            offset += chunk.byteLength;
        }
    }
    while (offset < size) buf[offset++] = 0;
    return buf;
}
export interface StreamReader {
    (len: number): Promise<Buffer>;
    (len: number, safe: boolean): Promise<Buffer | null>;
    cancel(): null | Buffer;
}
