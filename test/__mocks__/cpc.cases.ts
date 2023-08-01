import { vi, expect } from "vitest";
import { ReactionController } from "#rt/cpc.js";
import { baseDataTypes, objectDataTypes } from "./bson.cases.js";
export const callbackBaseArgs = baseDataTypes;

const { objectId, ...callBackObjectArgs } = objectDataTypes;
export { callBackObjectArgs };
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
