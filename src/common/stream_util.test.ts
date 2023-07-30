import { it, describe, expect } from "vitest";
import {
    toDynamicLenData,
    readDynamicLenData,
    createFixedStreamReader,
    createReaderFromReadable,
} from "./stream_util.js";
import { Readable } from "stream";

describe("toDynamicLenData", function () {
    const cases: [number | bigint, string][] = [
        [1, "1"],
        [0xff, "10000001_01111111"],
        [0xffff, "10000011_11111111_01111111"],
        [0xffffff, "10000111_11111111_11111111_01111111"],
        [0xffffffff, "10001111_11111111_11111111_11111111_01111111"],
        [0xffffffffff, "10011111_11111111_11111111_11111111_11111111_01111111"],
        [0xffffffffffff, "10111111_11111111_11111111_11111111_11111111_11111111_01111111"],
        [0xffffffffffffffn, "11111111_11111111_11111111_11111111_11111111_11111111_11111111_01111111"],
    ];
    describe("toDynamicLenData", function () {
        it.each(cases)("%s", function (input, output) {
            let buf = toDynamicLenData(input);

            expect(formatBin(buf), input.toString(16)).toBe(output);
        });
    });

    describe("readDynamicLenData", function () {
        it.each(cases)("%s", async function (input) {
            const reader = createFixedStreamReader(toDynamicLenData(input));
            let data = await readDynamicLenData(reader);
            expect(data).toMatchObject(BigInt(input));
        });
    });
});
describe("createReaderFromReadable", function () {
    function createMockRead() {
        const readable = new Readable({ read(size) {} });
        const read = createReaderFromReadable(readable);
        return { readable, read };
    }

    describe("等待分段", function () {
        it("一个chunk足够多个分段", async function () {
            const { read, readable } = createMockRead();
            readable.push(Buffer.allocUnsafe(10));
            readable.push(null);
            await expect(read(4)).resolves.toHaveLength(4);
            await expect(read(2)).resolves.toHaveLength(2);
            await expect(read(2)).resolves.toHaveLength(2);
            await expect(read(2)).resolves.toHaveLength(2);
            await expect(read(2, true)).resolves.toBe(null);
        });
        it("需要等待多个chunk", async function () {
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
        it("等待的chunk足够下一个分段", async function () {
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
    it("同一个readable创建第二次", function () {
        const { read, readable } = createMockRead();
        expect(() => createReaderFromReadable(readable)).toThrowError();
    });

    it("不安全读取", async function () {
        const { read, readable } = createMockRead();
        let pms = read(4);
        readable.push(Buffer.allocUnsafe(2));
        readable.push(null);
        await expect(pms).rejects.toThrowError();
    });

    const { read, readable } = createMockRead();
    it("安全读取", async function () {
        let pms = read(4, true);
        readable.push(Buffer.allocUnsafe(2));
        readable.push(null);
        await expect(pms).resolves.toBe(null);
    });

    it("结束的流继续读取", async function () {
        await expect(read(4)).rejects.toThrowError();
    });
}, 1000);
function formatBin(num_buf: number | Buffer) {
    let str = "";
    if (typeof num_buf === "number") {
        str = num_buf.toString(2);
        while (num_buf > 0xff) {
            let binStr = (num_buf % 0x100).toString(2);
            binStr = "0".repeat(8 - binStr.length) + binStr;
            str = binStr + "_" + str;
            num_buf >>>= 8;
        }
        str = num_buf.toString(2) + "_" + str;
        return str.slice(0, -1);
    } else {
        str = num_buf[0].toString(2);
        for (let i = 1; i < num_buf.length; i++) {
            let binStr = num_buf[i].toString(2);
            binStr = "0".repeat(8 - binStr.length) + binStr;
            str += "_" + binStr;
        }
        return str;
    }
}
