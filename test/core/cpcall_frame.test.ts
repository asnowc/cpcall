import { describe, expect, vi } from "vitest";
import { FrameType, Frame, CallerStatus, ServiceStatus } from "cpcall";
import { cpcTest as test } from "../env/cpc.env.ts";
import { afterTime } from "evlib";

/**
 * 这个测试的是实例的数据帧发送和解析是否正常
 */

describe("call-response", function () {
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
});
describe("状态更改", function () {
  test("endCall()", async function ({ cpcHandle }) {
    const { cpc, ctrl, source } = cpcHandle;

    expect(cpc.callerStatus).toBe(0);

    const r1 = cpc.call(0); //发起一个调用

    cpc.endCall();
    expect(cpc.callerStatus).toBe(CallerStatus.ending);

    expect(source.sendFrame.mock.calls[1][0], "已发送 endCall 帧").toEqual({
      type: FrameType.endCall,
    } satisfies Frame.EndCall);

    ctrl.nextFrame({ type: FrameType.promise, id: 2 }); //相应返回 promise
    ctrl.nextFrame({ type: FrameType.endServe }); // finish 帧

    expect(cpc.callerStatus).toBe(CallerStatus.ended);

    ctrl.nextFrame({ type: FrameType.resolve, id: 2, value: "r1" }); // r1 resolve

    expect(cpc.callerStatus).toBe(CallerStatus.finished);
    await expect(r1).resolves.toBe("r1");
  });
  test("endServe()", async function ({ cpcHandle }) {
    const { cpc, ctrl, source } = cpcHandle;

    cpc.endServe();
    const calls = source.sendFrame.mock.calls;
    expect(calls[0][0]).toMatchObject({ type: FrameType.endServe });
    expect(cpc.serviceStatus, "不存在返回队列自动结束").toBe(ServiceStatus.finished);
    await expect(cpc.onServeEnd).resolves.toBeUndefined();
  });

  test("close()", async function ({ cpcHandle }) {
    const { cpc, ctrl, source } = cpcHandle;
    setTimeout(() => {
      ctrl.nextFrame({ type: FrameType.endServe });
      ctrl.nextFrame({ type: FrameType.endCall });
    });
    await cpc.close();

    // 下面的帧应该被忽略
    ctrl.nextFrame({ type: FrameType.exec, args: [] });
    ctrl.nextFrame({ type: FrameType.call, args: [] });
    ctrl.nextFrame({ type: FrameType.endCall });
    ctrl.nextFrame({ type: FrameType.endServe });
    ctrl.endFrame(new Error("被忽略的异常1"));
    ctrl.endFrame(new Error("被忽略的异常2"));

    await afterTime();

    expect(source.close).toBeCalledTimes(1);
    expect(source.dispose).toBeCalledTimes(0);
    ctrl.nextFrame({ type: FrameType.call, args: ["abc"] }); //传一些错误的帧
    expect(cpc.closed).toBeTruthy();
  });

  test("主动调用 dispose()", async function ({ cpcHandle }) {
    const { cpc, ctrl, source } = cpcHandle;
    const err = new Error("主动调用dispose");
    cpc.dispose(err);

    // 下面的帧应该被忽略
    ctrl.nextFrame({ type: FrameType.exec, args: [] });
    ctrl.nextFrame({ type: FrameType.call, args: [] });
    ctrl.nextFrame({ type: FrameType.endCall });
    ctrl.nextFrame({ type: FrameType.endServe });
    ctrl.endFrame(new Error("被忽略的异常"));
    ctrl.endFrame(new Error("被忽略的异常"));
    await cpc.onClose;

    expect(source.close).toBeCalledTimes(0);
    expect(source.dispose).toBeCalledTimes(1);
    expect(source.dispose).toBeCalledWith(err);
    source.close();
  });
});

test("source 异常", async function ({ cpcHandle }) {
  const { cpc, ctrl, source } = cpcHandle;
  const error = new Error("source error");
  ctrl.endFrame(error);
  await expect(cpc.onClose).resolves.toBeUndefined();

  // 下面的帧应该被忽略
  ctrl.nextFrame({ type: FrameType.exec, args: [] });
  ctrl.nextFrame({ type: FrameType.call, args: [] });
  ctrl.nextFrame({ type: FrameType.endCall });
  ctrl.nextFrame({ type: FrameType.endServe });
  ctrl.endFrame(new Error("被忽略的异常"));
  ctrl.endFrame(new Error("被忽略的异常"));

  expect(source.dispose).toBeCalledWith(error);
  expect(source.close).not.toBeCalled();
});

describe("错误帧", function () {
  test("错误的响应", async function ({ cpcHandle }) {
    const { cpc, ctrl, source } = cpcHandle;

    ctrl.nextFrame({ type: FrameType.return, value: "value" }); //不存在的返回值"
    ctrl.nextFrame({ type: FrameType.throw, value: "value" });
    ctrl.nextFrame({ type: FrameType.promise, id: 2 });
    ctrl.nextFrame({ type: FrameType.resolve, id: 1, value: "a" });
    ctrl.nextFrame({ type: FrameType.reject, id: 2, value: "b" });

    const r1 = cpc.call();
    const r2 = cpc.call();
    ctrl.nextFrame({ type: FrameType.promise, id: 1 });
    ctrl.nextFrame({ type: FrameType.promise, id: 1 });
    await expect(r2).rejects.toThrowError();
    ctrl.nextFrame({ type: FrameType.resolve, id: 1, value: "r1" });
    cpc.dispose();

    await expect(r1).resolves.toBe("r1");
  });
});
