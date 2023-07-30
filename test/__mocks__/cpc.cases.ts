import { vi } from "vitest";
export const callBackArgs = {
    noContent: [undefined, null, true, false],
    int: [-2147483648, -66, -1, 0, 1, , 2147483647],
    bigint: [-9223372036854775808n, , -1n, 0n, 1n, , 9223372036854775807n],
    double: [-1.1, 1.1, NaN, Infinity, -Infinity],
    buffer: [Buffer.from("abcd", "ascii"), Buffer.from("")],
    string: ["abcd中文123", ""],
    map: [{ a: 8, b: false, q: [1, 3, "a", null], c: { a: 9 } }],
    array: [[1, 4, "2"]],
};

export function createServerFnCase() {
    return {
        returnArg0: vi.fn((arg1) => arg1),
        asyncReturnArgs: vi.fn(async (...args: any[]) => {
            await new Promise((resolve) => setTimeout(resolve));
            return args;
        }),
        throwError: vi.fn(() => {
            throw new Error("yy");
        }),
        throwArg0: vi.fn((arg) => {
            throw arg;
        }),
        asyncThrowError: vi.fn(async () => {
            await new Promise((resolve) => setTimeout(resolve));
            throw new Error("yy");
        }),
        asyncThrowArg0: vi.fn(async (arg) => {
            await new Promise((resolve) => setTimeout(resolve));
            throw arg;
        }),
    };
}
