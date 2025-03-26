import { expect } from "vitest";
import { FrameType, Frame } from "cpcall";
import { cpcTest as test } from "../env/cpc.env.ts";

/**
 * 测试实例的数据帧发送和解析是否正常
 */
test("call-return", async function ({ cpcSuite }) {
  const { cpc1, cpc1Src, cpc2, cpc2Src } = cpcSuite;
  cpc2.exposeObject({ cmd: (...args: any[]) => args });

  const args = ["cmd", 12, null, "str"];

  const promise = cpc1.call(...args);
  await expect(promise).resolves.toEqual(args.slice(1));

  expect(cpc1Src.sendFrame.mock.calls[0][0], "call frame").toEqual({
    type: FrameType.call,
    args,
  } satisfies Frame.Call);
  expect(cpc2Src.sendFrame.mock.calls[0][0], "return frame").toEqual({
    type: FrameType.return,
    value: args.slice(1),
  } satisfies Frame.Return);
});
test("call-throw", async function ({ cpcSuite }) {
  const { cpc1, cpc1Src, cpc2, cpc2Src } = cpcSuite;

  cpc2.exposeObject({
    cmd: (...args: any[]) => {
      throw new Error("hhh");
    },
  });
  await expect(cpc1.call("cmd")).rejects.toThrowError("hhh");

  expect(cpc2Src.sendFrame.mock.calls[0][0], "return frame").toMatchObject({
    type: FrameType.throw,
  });
});
test("call-resolve", async function ({ cpcSuite }) {
  const { cpc1, cpc1Src, cpc2, cpc2Src } = cpcSuite;
  cpc2.exposeObject({
    cmd: async (...args: any) => {
      return "ok";
    },
  });
  const promise = cpc1.call("cmd");
  await expect(promise).resolves.toBe("ok");

  const cpc2SendMok = cpc2Src.sendFrame.mock;
  expect(cpc2SendMok.calls[0][0]).toMatchObject({ type: FrameType.promise });
  expect(cpc2SendMok.calls[1][0]).toMatchObject({ type: FrameType.resolve, value: "ok" });
});
test("call-reject", async function ({ cpcSuite }) {
  const { cpc1, cpc1Src, cpc2, cpc2Src } = cpcSuite;

  cpc2.exposeObject({
    cmd: async (...args: any) => {
      throw "err";
    },
  });
  await expect(cpc1.call("cmd")).rejects.toBe("err");

  const cpc2SendMok = cpc2Src.sendFrame.mock;
  expect(cpc2SendMok.calls[0][0]).toMatchObject({ type: FrameType.promise });
  expect(cpc2SendMok.calls[1][0]).toMatchObject({ type: FrameType.reject, value: "err" });
});
