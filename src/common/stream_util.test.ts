import { it, describe, expect } from "vitest";
import { numToDLD, DLD } from "./stream_util.js";

describe("DLD", function () {
    describe("numToDLD", function () {
        const cases: [number | bigint, string][] = [
            [1, "1"],
            [0xff, "10000001_01111111"],
            [0xffff, "10000011_11111111_01111111"],
            [0xffffff, "10000111_11111111_11111111_01111111"],
            [0xffffffff, "10001111_11111111_11111111_11111111_01111111"],
            [0x100000000, "10010000_10000000_10000000_10000000_00000000"],
            [0xffffffffff, "10011111_11111111_11111111_11111111_11111111_01111111"],
            [0xffffffffffff, "10111111_11111111_11111111_11111111_11111111_11111111_01111111"],
            [0xffffffffffffffn, "11111111_11111111_11111111_11111111_11111111_11111111_11111111_01111111"],
        ];
        it.each(cases)("%s", function (input, output) {
            let buf = numToDLD(input);

            expect(formatBin(buf), input.toString(16)).toBe(output);
        });
        it("负数", () => expect(() => numToDLD(-1)).toThrowError());
    });
    /** 极值 */
    const cases2 = [
        0,
        0x7f,
        0x80,
        0x3fff,
        0x4000,
        0x1fffff,
        0x200000,
        0xfffffff,
        0x10000000,
        0x7_ffffffff,
        0x8_00000000,
        0x3ff_ffffffff,
        0x400_00000000,
        0x1ffff_ffffffff,
        0x20000_00000000,
        0xffffff_ffffffffn,
    ];
    describe("write/read:bigInt", function () {
        cases2.forEach((input, i) => {
            it(input.toString(16), function () {
                const dldBuf = numToDLD(input);
                let [data, len] = DLD.readBigIntSync(dldBuf);
                expect(data).toBe(BigInt(input));
                expect(len).toBe(dldBuf.byteLength);
            });
        });
    });
    describe("write/read:number", function () {
        cases2.slice(0, -1).forEach((input, i) => {
            it(input.toString(16), function () {
                const dldBuf = numToDLD(input);
                let [data, len] = DLD.readNumberSync(dldBuf);
                expect(data).toBe(input);
                expect(len).toBe(dldBuf.byteLength);
            });
        });
    });
});

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
