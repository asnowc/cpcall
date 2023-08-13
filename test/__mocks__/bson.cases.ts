import { ObjectId } from "#lib/js_bson.js";
import { vi, expect } from "vitest";

export const baseDataTypes = {
    noContent: [undefined, null, true, false],
    int: [-2147483648, -66, -1, 0, 1, , 2147483647],
    bigint: [-9223372036854775808n, , -1n, 0n, 1n, , 9223372036854775807n],
    double: [-1.1, 1.1, NaN, Infinity, -Infinity],
    string: ["abcd中文123", ""],
    map: [{ a: 8, b: false, q: [1, 3, "a", null], c: { a: 9 } }],
    array: [[1, 4, "2"]],
};
export type ObjectDataType = { data: any[]; expect(rawData: any, data: any, msg?: string | number): void };
export const objectDataTypes = {
    buffer: {
        data: [Buffer.from("abcd", "ascii"), Buffer.from("")],
        expect: (rawData: Buffer, data: any) => {
            expect(data).instanceof(Buffer);
            expect(data.toString("hex")).toBe(rawData.toString("hex"));
        },
    },
    arrayBuffer: {
        data: [new ArrayBuffer(5)],
        expect(rawData: ArrayBuffer, data: any) {
            expect(data).instanceof(ArrayBuffer);
            expect(Buffer.from(data).toString("hex")).toBe(Buffer.from(rawData).toString("hex"));
        },
    },
    error: {
        data: [new Error("abc"), new Error("abc", { cause: 23 })],
        expect(rawData: Error, data: any) {
            expect(data).instanceof(Error);
            expect(rawData).toMatchObject(data);
        },
    },
    objectId: {
        data: [new ObjectId(88n), new ObjectId(0), new ObjectId(2 ** 32 + 1)],
        expect(rawData: ObjectId, data: any, msg?: number | string) {
            expect(data, msg?.toString()).toEqual(rawData);
            expect(data, msg?.toString()).instanceof(ObjectId);
        },
    },
    regExp: {
        data: [/\d+./],
        expect(rawData: RegExp, data: any) {
            expect(data).instanceof(RegExp);
            expect(data.source).toBe(rawData.source);
        },
    },
};
