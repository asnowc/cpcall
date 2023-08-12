import { Readable } from "node:stream";
import { describe, test, expect } from "vitest";
import { createReaderFromReadable } from "./node_stream_util.js";

describe("createReaderFromReadable", function () {
    function createMockRead() {
        const readable = new Readable({ read(size) {} });
        const read = createReaderFromReadable(readable);
        return { readable, read };
    }

    describe("等待分段", function () {
        test("一个chunk足够多个分段", async function () {
            const { read, readable } = createMockRead();
            readable.push(Buffer.allocUnsafe(10));
            readable.push(null);
            await expect(read(4)).resolves.toHaveLength(4);
            await expect(read(2)).resolves.toHaveLength(2);
            await expect(read(2)).resolves.toHaveLength(2);
            await expect(read(2)).resolves.toHaveLength(2);
            await expect(read(2, true)).resolves.toBe(null);
        });
        test("需要等待多个chunk", async function () {
            const { read, readable } = createMockRead();
            let pms = read(4);
            expect(pms).resolves.toHaveLength(4);
            {
                //mock
                readable.push(Buffer.allocUnsafe(2));
                await new Promise<void>((resolve) => setTimeout(resolve));
                readable.push(Buffer.allocUnsafe(2));
                readable.push(null);
            }
            await pms;
            await expect(read(2, true)).resolves.toBe(null);
        });
        test("等待的chunk足够下一个分段", async function () {
            const { read, readable } = createMockRead();
            let pms = read(4);
            expect(pms).resolves.toHaveLength(4);
            readable.push(Buffer.allocUnsafe(2));
            await new Promise<void>((resolve) => setTimeout(resolve));
            readable.push(Buffer.allocUnsafe(6));
            readable.push(null);
            await pms;
            await expect(read(4)).resolves.toHaveLength(4);
            // await expect(read(2, true)).resolves.toBe(null);
        });
    });
    test("同一个readable创建第二次", function () {
        const { read, readable } = createMockRead();
        expect(() => createReaderFromReadable(readable)).toThrowError();
    });

    test("不安全读取", async function () {
        const { read, readable } = createMockRead();
        let pms = read(4);
        readable.push(Buffer.allocUnsafe(2));
        readable.push(null);
        await expect(pms).rejects.toThrowError();
    });

    const { read, readable } = createMockRead();
    test("安全读取", async function () {
        let pms = read(4, true);
        readable.push(Buffer.allocUnsafe(2));
        readable.push(null);
        await expect(pms).resolves.toBe(null);
    });

    test("结束的流继续读取", async function () {
        await expect(read(4)).rejects.toThrowError();
    });
}, 1000);
