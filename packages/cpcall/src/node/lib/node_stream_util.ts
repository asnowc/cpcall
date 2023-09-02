import type { Readable } from "node:stream";

/**
 * @public
 * @remark 创建对 Readable 的 StreamScanner
 */
export function createReaderFromReadable(readable: Readable): StreamScannerCtrl {
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
                    return resolve(buf);
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
    function onEnd(reason?: any) {
        ended = true;

        readable.off("readable", onReadable);
        readable.off("end", onEnd);
        readable.off("close", onEnd);

        let need = cacheTotal;
        for (let i = 0; i < handles.length; i++) {
            let item = handles[i];
            if (item.safe) item.resolve(null);
            else {
                let err = reason;
                if (err === undefined) {
                    err = new Error(
                        `Stream has ended. ${item.size} bytes need to be read and ${
                            item.size - need
                        } bytes need to be entered`
                    );
                }
                item.reject(err);
            }
            need -= item.size;
        }
        handles = [];
    }
    if (!readable.readableEnded) {
        readable.on("readable", onReadable);
        readable.on("end", onEnd);
        readable.on("close", onEnd);
    } else ended = true;
    function cancel(reason?: any): null | Buffer {
        onEnd(reason ?? new Error("Reader has be cancel"));
        if (cache.length) {
            if (readable.readableEnded) {
                const buf = Buffer.concat(cache);
                cache = [];
                return buf;
            } else {
                for (let i = 0; i < cache.length; i++) readable.unshift(cache[i]);
                cache = [];
                return null;
            }
        }
        return null;
    }

    return { cancel, read };
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

/**
 * @public
 * @remark 异步扫描器
 */
export interface StreamScanner<T = Buffer> {
    /** @remark 读取指定长度，如果Stream不足该长度，则抛出异常 */
    (len: number): Promise<T>;
    /** @remark 安全读取指定长度，如果Stream不足该长度，则返回 null */
    (len: number, safe: boolean): Promise<T | null>;
}
export type StreamScannerCtrl<T = Buffer> = {
    read: StreamScanner<T>;

    /**
     * @remark 取消对流的扫描。
     * 取消时如果流已经发出end事件，并且未完全扫描所有chunk则返回剩余未扫描的部分
     */
    cancel(reason?: any): null | T;
};
