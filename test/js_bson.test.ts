import { DataType, JBSON, toArrayJBSON, toMapJBSON, DLD, numToDLD, BsonScanItem } from "#lib/js_bson.js";
import { baseDataTypes, objectDataTypes } from "./__mocks__/bson.cases.js";
import { describe, it, expect } from "vitest";
const mapCases: Record<string, any> = {
    0: { a: 1, b: 2, c: 3 },
    1: { a: false, b: [1, "a", null] }, // [4, 1,97, ] [13,1,98,[5,0,0,0,1, 10,1,97, 1, 0], 0]
    2: { a: false, b: { a: 9, b: null } },
};

describe("同步转换器", function () {
    describe("array类型", function () {
        it.each(Object.entries(baseDataTypes))("%s", async function (type, cases) {
            const buffer = toArrayJBSON(cases);
            const array = JBSON.toArray(buffer);
            expect(array).toEqual(cases);
        });
        it.each(Object.entries(objectDataTypes))("%s", async function (type, { data, expect: cusExpect }) {
            const buffer = toArrayJBSON(data);
            const array = JBSON.toArray(buffer);

            for (let i = 0; i < array.length; i++) {
                cusExpect(data[i] as any, array[i], i);
            }
        });
    });
    describe("map类型", function () {
        it.each(Object.entries(mapCases))("%s - %s", async function (index, cases) {
            const buffer = toMapJBSON(cases);
            const map = JBSON.toMap(buffer);
            expect(map).toEqual(cases);
        });
    });
});
describe("异步转换器", function () {
    async function scanToValue<T extends Record<number | string, any>>(
        itr: AsyncGenerator<BsonScanItem, void, void>,
        obj: T
    ): Promise<T> {
        let res = await itr.next();
        while (!res.done) {
            const item = res.value;
            let value = item.value;
            if (item.isIterator) value = await scanToValue(item.value, item.dataType === DataType.array ? [] : {});
            (obj as any)[item.key] = value;
            res = await itr.next();
        }
        return obj;
    }

    describe("scanArray", function () {
        it.each(Object.entries(baseDataTypes))("%s", async function (type, cases) {
            const reader = createFixedStreamReader(toArrayJBSON(cases));

            type;
            const array = await scanToValue(JBSON.scanArray(reader), []);
            expect(array).toEqual(cases);
        });
        it.each(Object.entries(objectDataTypes))("%s", async function (type, { data, expect: cusExpect }) {
            const reader = createFixedStreamReader(toArrayJBSON(data));

            const array = await scanToValue(JBSON.scanArray(reader), [] as number[]);
            for (let i = 0; i < array.length; i++) {
                cusExpect(data[i] as any, array[i], i);
            }
        });
    });
    describe("scanMap", function () {
        it.each(Object.entries(mapCases))("%s - %s", async function (type, cases) {
            const reader = createFixedStreamReader(toMapJBSON(cases));

            const map = await scanToValue(JBSON.scanMap(reader), {});
            expect(map).toEqual(cases);
        });
    });
    describe("readArray", function () {
        it.each(Object.entries(baseDataTypes))("%s", async function (type, cases) {
            const reader = createFixedStreamReader(toArrayJBSON(cases));

            const array = await JBSON.readArray(reader);
            expect(array).toEqual(cases);
        });
    });
    describe("readMap", function () {
        it.each(Object.entries(mapCases))("%s - %s", async function (index, cases) {
            const reader = createFixedStreamReader(toMapJBSON(cases));

            const array = await JBSON.readMap(reader);
            expect(array).toEqual(cases);
        });
    });
});

describe("DLD", function () {
    describe("numToDLD", function () {
        const cases: [number | bigint, string][] = [
            [1, "1"],
            [0xff, "10000000_11111111"],
            [0xffff, "11000000_11111111_11111111"],
            [0xffffff, "11100000_11111111_11111111_11111111"],
            [0xffffffff, "11110000_11111111_11111111_11111111_11111111"],
            [0x1_00000000, "11110001_00000000_00000000_00000000_00000000"],
            [0xff_ffffffff, "11111000_11111111_11111111_11111111_11111111_11111111"],
            [0xffff_ffffffff, "11111100_11111111_11111111_11111111_11111111_11111111_11111111"],
            [0xffffff_ffffffffn, "11111110_11111111_11111111_11111111_11111111_11111111_11111111_11111111"],
        ];
        it.each(cases)("%s", function (input, output) {
            let buf = numToDLD(input);

            expect(formatBin(buf), input.toString(16)).toBe(output);
        });
        it("负数", () => expect(() => numToDLD(-1)).toThrowError());
        it("小数", () => expect(() => numToDLD(2.25)).toThrowError());
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

function formatBin(num_buf: number | Uint8Array) {
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

/** 固定 Buffer 的 StreamReader*/
export function createFixedStreamReader(buffer: Uint8Array) {
    let offset = 0;
    return async function streamReader(size: number) {
        let end = offset + size;
        if (end > buffer.length) throw new Error("out of range");
        let buf = buffer.subarray(offset, end);
        offset = end;
        return buf;
    };
}
