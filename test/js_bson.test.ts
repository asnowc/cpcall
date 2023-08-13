import { DataType, JBSON, toArrayJBSON, toMapJBSON, BsonScanItem } from "#lib/js_bson.js";
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

/** 固定 Buffer 的 StreamReader*/
export function createFixedStreamReader(buffer: Buffer) {
    let offset = 0;
    return async function streamReader(size: number) {
        let end = offset + size;
        if (end > buffer.length) throw new Error("out of range");
        let buf = buffer.subarray(offset, end);
        offset = end;
        return buf;
    };
}
