import { RpcFrame, FrameType, encodeCpcFrame } from "cpcall";
import { describe } from "node:test";
import { expect, test } from "vitest";
import { baseDataTypes } from "../__mocks__/data_type.cases.js";
function encodeCpcFrameHex(frame: RpcFrame) {
  const u8Arr = encodeCpcFrame(frame);
  return u8ArrToHex(u8Arr);
}
describe("caller", function () {
  test("call", async function () {
    const hex = encodeCpcFrameHex([FrameType.call, ["abcd", 1, "null"]]);
    expect(hex).toMatchSnapshot();
  });
  test("exec", async function () {
    const hex = encodeCpcFrameHex([FrameType.exec, ["abcd", 1, "null"]]);
    expect(hex).toMatchSnapshot();
  });
});
describe("response", function () {
  test("return", async function () {
    const hex = encodeCpcFrameHex([FrameType.return, 3]);
    expect(hex).toMatchSnapshot();
  });
  test("throw", async function () {
    const hex = encodeCpcFrameHex([FrameType.throw, new Error("err")]);
    expect(hex).toMatchSnapshot();
  });
  test("promise", async function () {
    const hex = encodeCpcFrameHex([FrameType.promise, 325]);
    expect(hex).toMatchSnapshot();
  });
  test("resolve", async function () {
    const hex = encodeCpcFrameHex([FrameType.resolve, 3, "ab"]);
    expect(hex).toMatchSnapshot();
  });
  test("reject", async function () {
    const hex = encodeCpcFrameHex([FrameType.reject, 3, "ab"]);
    expect(hex).toMatchSnapshot();
  });
});
describe("action", function () {
  test("fin", async function () {
    const hex = encodeCpcFrameHex([FrameType.end]);
    expect(hex).toMatchSnapshot();
  });
  test("disable", async function () {
    const hex = encodeCpcFrameHex([FrameType.disable]);
    expect(hex).toMatchSnapshot();
  });
});
/** 测试参数传输 */
describe("数据类型二进制", function () {
  const cases = Object.entries(baseDataTypes);
  test.each(cases)("%s", async function ([key, arg]) {
    const hex = encodeCpcFrameHex([FrameType.call, ["fn", ...arg]]);
    expect(hex).toMatchSnapshot();
  });
});

function u8ArrToHex(u8Arr: Uint8Array) {
  return Buffer.from(u8Arr, u8Arr.byteOffset, u8Arr.byteLength).toString("hex");
}
