import { RpcFrame, FrameType, trans } from "cpcall";
import { describe } from "node:test";
import { expect, test } from "vitest";
import { baseDataTypes } from "../__mocks__/data_type.cases.ts";
const { CpcFrameEncoder } = trans;
function encodeCpcFrameHex(frame: RpcFrame) {
  const u8Arr = new CpcFrameEncoder(frame).encode();
  return u8ArrToHex(u8Arr);
}
describe("caller", function () {
  test("call", async function () {
    const hex = encodeCpcFrameHex({ type: FrameType.call, args: ["abcd", 1, "null"] });
    expect(hex).toMatchSnapshot();
  });
  test("exec", async function () {
    const hex = encodeCpcFrameHex({ type: FrameType.exec, args: ["abcd", 1, "null"] });
    expect(hex).toMatchSnapshot();
  });
});
describe("response", function () {
  test("return", async function () {
    const hex = encodeCpcFrameHex({ type: FrameType.return, value: 3 });
    expect(hex).toMatchSnapshot();
  });
  test("throw", async function () {
    const hex = encodeCpcFrameHex({ type: FrameType.throw, value: new Error("err") });
    expect(hex).toMatchSnapshot();
  });
  test("promise", async function () {
    const hex = encodeCpcFrameHex({ type: FrameType.promise, id: 325 });
    expect(hex).toMatchSnapshot();
  });
  test("resolve", async function () {
    const hex = encodeCpcFrameHex({ type: FrameType.resolve, id: 3, value: "ab" });
    expect(hex).toMatchSnapshot();
  });
  test("reject", async function () {
    const hex = encodeCpcFrameHex({ type: FrameType.reject, id: 3, value: "ab" });
    expect(hex).toMatchSnapshot();
  });
});
describe("action", function () {
  test("fin", async function () {
    const hex = encodeCpcFrameHex({ type: FrameType.endCall });
    expect(hex).toMatchSnapshot();
  });
  test("disable", async function () {
    const hex = encodeCpcFrameHex({ type: FrameType.endServe });
    expect(hex).toMatchSnapshot();
  });
});
/** 测试参数传输 */
describe("数据类型二进制", function () {
  const cases = Object.entries(baseDataTypes);
  test.each(cases)("%s", async function ([key, arg]) {
    const hex = encodeCpcFrameHex({ type: FrameType.call, args: ["fn", ...arg] });
    expect(hex).toMatchSnapshot();
  });
});

function u8ArrToHex(u8Arr: Uint8Array) {
  return Buffer.from(u8Arr, u8Arr.byteOffset, u8Arr.byteLength).toString("hex");
}
