import { DataType, JSBSON, ObjectId, BsonScanItem } from "#rt/common/js_bson.js";
import { createFixedStreamReader, AllListStreamWriter } from "#rt/common/stream_util.js";
import { baseDataTypes, objectDataTypes } from "./__mocks__/bson.cases.js";
import { describe, it, expect } from "vitest";

describe("JsBSONTransformer", function () {
    const mapCases: Record<string, any> = {
        0: { a: 1, b: 2, c: 3 },
        1: { a: false, b: [1, "a", null] }, // [4, 1,97, ] [13,1,98,[5,0,0,0,1, 10,1,97, 1, 0], 0]
        2: { a: false, b: { a: 9, b: null } },
    };

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
            const transformer = new JSBSON();
            const writer = new AllListStreamWriter();

            transformer.writeArray(cases, writer.write);
            const reader = createFixedStreamReader(writer.getAll());

            const array = await scanToValue(transformer.scanArray(reader), []);
            expect(array).toEqual(cases);
        });
        it.each(Object.entries(objectDataTypes))("%s", async function (type, { data, expect: cusExpect }) {
            const transformer = new JSBSON();
            const writer = new AllListStreamWriter();

            transformer.writeArray(data, writer.write);
            const reader = createFixedStreamReader(writer.getAll());

            const array = await scanToValue(transformer.scanArray(reader), [] as number[]);
            for (let i = 0; i < array.length; i++) {
                cusExpect(data[i], array[i], i);
            }
        });
    });
    describe("scanMap", function () {
        it.each(Object.entries(mapCases))("%s - %s", async function (index, cases) {
            const transformer = new JSBSON();
            const writer = new AllListStreamWriter();

            transformer.writeMap(cases, writer.write);
            const reader = createFixedStreamReader(writer.getAll());

            const map = await scanToValue(transformer.scanMap(reader), {});
            expect(map).toEqual(cases);
        });
    });
    describe("readArray", function () {
        it.each(Object.entries(baseDataTypes))("%s", async function (type, cases) {
            const transformer = new JSBSON();
            const writer = new AllListStreamWriter();
            transformer.writeArray(cases, writer.write);

            const reader = createFixedStreamReader(writer.getAll());
            const array = await transformer.readArray(reader);
            expect(array).toEqual(cases);
        });
    });
    describe("readMap", function () {
        it.each(Object.entries(mapCases))("%s - %s", async function (index, cases) {
            const transformer = new JSBSON();
            const writer = new AllListStreamWriter();
            transformer.writeMap(cases, writer.write);
            const reader = createFixedStreamReader(writer.getAll());

            const array = await transformer.readMap(reader);
            expect(array).toEqual(cases);
        });
    });
});
