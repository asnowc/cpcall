import { DataType, JsBSON, ObjectId, BsonScanItem } from "#rt/common/js_bson.js";
import { createFixedStreamReader, AllListStreamWriter } from "#rt/common/stream_util.js";
import { describe, it, expect } from "vitest";

describe("JsBSONTransformer", function () {
    const arrayCases: Record<string, any[]> = {
        noContentData: [undefined, null, true, false],
        intList: [-2147483648, -66, -1, 0, 1, 66, 3666, 2147483647],
        bigint: [-9223372036854775808n, -66n, -1n, 0n, 1n, 66n, 9223372036854775807n],
        double: [-1.1, 1.1, NaN, Infinity, -Infinity],
        string: ["中文", "abc", "1234.+=", ""],
        arrayBuffer: [new ArrayBuffer(5)],
        id: [new ObjectId(9223372036854775807n), new ObjectId(-1), new ObjectId(2 ** 32 + 1)],
        regExp: [/\d+./],
        buffer: [Buffer.from("abcd"), Buffer.from("")],
        error: [new Error("abc", { cause: { a: 1, b: 8 } })],
    };
    const mapCases: Record<string, any> = {
        0: { a: 1, b: 2, c: 3 },
        1: { a: false, b: [1, "a", null] }, // [4, 1,97, ] [13,1,98,[5,0,0,0,1, 10,1,97, 1, 0], 0]
        2: { a: false, b: { a: 9, b: null } },
    };

    async function scanToValue(itr: AsyncGenerator<BsonScanItem, void, void>, obj: Record<number | string, any>) {
        let res = await itr.next();
        while (!res.done) {
            const item = res.value;
            let value = item.value;
            if (item.isIterator) value = await scanToValue(item.value, item.dataType === DataType.array ? [] : {});
            obj[item.key] = value;
            res = await itr.next();
        }
        return obj;
    }
    describe("scanArray", function () {
        it.each(Object.entries(arrayCases))("%s", async function (type, cases) {
            const transformer = new JsBSON();
            const writer = new AllListStreamWriter();

            transformer.writeArray(cases, writer.write);
            const reader = createFixedStreamReader(writer.getAll());

            const array = await scanToValue(transformer.scanArray(reader), []);
            expect(array).toEqual(cases);
        });
    });
    describe("scanMap", function () {
        it.each(Object.entries(mapCases))("%s - %s", async function (index, cases) {
            const transformer = new JsBSON();
            const writer = new AllListStreamWriter();

            transformer.writeMap(cases, writer.write);
            const reader = createFixedStreamReader(writer.getAll());

            const map = await scanToValue(transformer.scanMap(reader), {});
            expect(map).toEqual(cases);
        });
    });
    describe("readArray", function () {
        it.each(Object.entries(arrayCases))("%s", async function (type, cases) {
            const transformer = new JsBSON();
            const writer = new AllListStreamWriter();
            transformer.writeArray(cases, writer.write);

            const reader = createFixedStreamReader(writer.getAll());
            const array = await transformer.readArray(reader);
            expect(array).toEqual(cases);
        });
    });
    describe("readMap", function () {
        it.each(Object.entries(mapCases))("%s - %s", async function (index, cases) {
            const transformer = new JsBSON();
            const writer = new AllListStreamWriter();
            transformer.writeMap(cases, writer.write);
            const reader = createFixedStreamReader(writer.getAll());

            const array = await transformer.readMap(reader);
            expect(array).toEqual(cases);
        });
    });
});
