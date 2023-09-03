import { strTransf } from "../../src/core/uit_array_util.js";
import { test, expect } from "vitest";
const { readByUtf8, writeByUtf8 } = strTransf;
const cases: { code: number; char: string }[] = [
    0, 0x7f, 0x80, 0x7ff, 0x800, 0xffff, 0x10000, 0x1ffff, 0x10ffff, 0x200000, 0x3ffffff, 0x4000000, 0x7fffffff,
].map((code) => ({ code, char: String.fromCharCode(code) }));

cases.forEach(({ code, char }) => {
    test(code.toString(), function () {
        const uint = writeByUtf8(char);
        const expectBuffer = Buffer.from(char, "utf-8");
        expect(Buffer.from(uint)).toEqual(expectBuffer);
        const toChar = readByUtf8(uint);
        expect(toChar).toBe(char);
    });
});
