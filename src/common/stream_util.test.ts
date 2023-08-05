import { it, describe, expect } from "vitest";
import { numToDLD, readNumberDLD, createFixedStreamReader } from "./stream_util.js";

describe("DLD", function () {
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
    describe("numToDLD", function () {
        it.each(cases)("%s", function (input, output) {
            let buf = numToDLD(input);

            expect(formatBin(buf), input.toString(16)).toBe(output);
        });
    });

    describe("readNumDLD", function () {
        it.each(cases)("%s", async function (input) {
            const reader = createFixedStreamReader(numToDLD(input));
            let data = await readNumberDLD(reader);
            expect(data).toMatchObject(BigInt(input));
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
