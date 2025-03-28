import { expect } from "vitest";
import { FrameType, Frame, CallerStatus, ServiceStatus, CpcFailRespondError, CpcFailAsyncRespondError } from "cpcall";
import { cpcTest as test } from "../env/cpc.env.ts";
import { afterTime } from "../utils/time.ts";

/**
 * 测试实例的状态变化
 */
test("endCall()调用后，CpCall 状态变化", async function ({ mockCpc: cpc }) {
  const { ctrl, mockSource } = cpc;

  expect(cpc.callerStatus).toBe(0);

  const r1 = cpc.call(0); //发起一个调用

  const endCallPromise = cpc.endCall();
  expect(cpc.callerStatus, "callerStatus 立即变为 ending").toBe(CallerStatus.ending);

  expect(mockSource.sendFrame.mock.calls[1][0], "已发送 endCall 帧").toEqual({
    type: FrameType.endCall,
  } satisfies Frame.EndCall);

  ctrl.nextFrame({ type: FrameType.promise, id: 2 }); //相应返回 promise
  ctrl.nextFrame({ type: FrameType.endServe }); // finish 帧

  expect(cpc.callerStatus, "收到 endServe 后，callerStatus 变为 ended").toBe(CallerStatus.ended);

  ctrl.nextFrame({ type: FrameType.resolve, id: 2, value: "r1" }); // r1 resolve

  expect(cpc.callerStatus, "所有 Promise 敲定后，callerStatus 变为 finished").toBe(CallerStatus.finished);
  await expect(r1).resolves.toBe("r1");
});
test("endServe()调用后，CpCall 状态变化", async function ({ mockCpc: cpc }) {
  const { mockSource } = cpc;

  cpc.endServe();
  const calls = mockSource.sendFrame.mock.calls;
  expect(calls[0][0], "立即发送 endServe 帧").toMatchObject({ type: FrameType.endServe });
  expect(cpc.serviceStatus, "不存在返回队列自动结束").toBe(ServiceStatus.finished);
  await expect(cpc.onServeEnd).resolves.toBeUndefined();
});

test("close()", async function ({ mockCpc: cpc }) {
  const { ctrl, mockSource } = cpc;
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

  expect(mockSource.close).toBeCalledTimes(1);
  expect(mockSource.dispose).toBeCalledTimes(0);
  ctrl.nextFrame({ type: FrameType.call, args: ["abc"] }); //传一些错误的帧, 会被忽略
  expect(cpc.closed).toBeTruthy();
});

test("主动调用 dispose()", async function ({ mockCpc: cpc }) {
  const { ctrl, mockSource } = cpc;
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

  expect(mockSource.close).toBeCalledTimes(0);
  expect(mockSource.dispose).toBeCalledTimes(1);
  expect(mockSource.dispose).toBeCalledWith(err);
  mockSource.close();
});

test("CpcFrameSource 发生异常", async function ({ mockCpc: cpc }) {
  const { ctrl, mockSource } = cpc;
  const error = new Error("source error");
  ctrl.endFrame(error); //模拟异常
  await expect(cpc.onClose).resolves.toBeUndefined();

  // 下面的帧应该被忽略
  ctrl.nextFrame({ type: FrameType.exec, args: [] });
  ctrl.nextFrame({ type: FrameType.call, args: [] });
  ctrl.nextFrame({ type: FrameType.endCall });
  ctrl.nextFrame({ type: FrameType.endServe });
  ctrl.endFrame(new Error("被忽略的异常"));
  ctrl.endFrame(new Error("被忽略的异常"));

  expect(mockSource.dispose).toBeCalledWith(error);
  expect(mockSource.close).not.toBeCalled();
});
//TODO: 需要拆分一下。也许强行中断更好
test("接受到错误帧，将被忽略", async function ({ mockCpc: cpc }) {
  const { ctrl } = cpc;

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
test("发起调用, 在返回前调用 dispose(), 挂起的 Promise 应该立即被 CpcFailRespondError 拒绝", async function ({
  mockCpc: cpc,
}) {
  const promise = cpc.call("yyy");
  await afterTime(50);

  const err = new Error("dispose");
  cpc.dispose(err);

  expect(cpc.callerStatus).toBe(CallerStatus.finished);
  await expect(promise, "在返回前中断").rejects.toThrowError(CpcFailRespondError);
});
test("发起调用, 远程已经返回了异步id，本地端强行断开连接后，挂起的 Promise 应被 CpcFailAsyncRespondError 拒绝", async function ({
  mockCpc: cpc,
}) {
  const { ctrl } = cpc;

  const promise = cpc.call("cmd");
  await afterTime();
  ctrl.nextFrame({ type: FrameType.promise, id: 1 });
  await afterTime();
  cpc.dispose();
  expect(cpc.callerStatus).toBe(CallerStatus.finished);

  await expect(promise).rejects.toThrowError(CpcFailAsyncRespondError);
});

test("数据源实例发生异常后 sendFrame 应不会被调用", async function ({ mockCpc: cpc }) {
  const err = new Error("源发生异常");

  const ctrl = cpc.mockSource;
  cpc.dispose(err);
  ctrl.sendFrame.mockRestore();
  expect(ctrl.sendFrame).not.toBeCalled();
});
test("CpCall 实例关闭时调用 CpcFrameSource.close() 如果抛出异常，则调用 CpcFrameSource.dispose()", async function ({
  mockCpc: cpc,
}) {
  const err = new Error("err");
  const { mockSource, ctrl } = cpc;
  mockSource.close.mockImplementation(() => {
    throw err;
  });

  ctrl.nextFrame({ type: FrameType.endCall });
  ctrl.nextFrame({ type: FrameType.endServe });
  await cpc.onClose;
  expect(mockSource.close).toBeCalledTimes(1);
  expect(mockSource.dispose, "close 无法正常关闭，应调用 dispose").toBeCalledTimes(1);
  expect(mockSource.dispose).toBeCalledWith(err);
});
