import { describe, test, expect, vi, afterEach, beforeEach } from "vitest";
import { CalleeCore, CallerCore, FrameType, RpcFrame } from "../../src/cpc/core/mod.ts";
import { CalleeFrame, CallerFrame, Frame } from "../../src/cpc/core/type.ts";
import { afterTime } from "evlib";
describe("caller", function () {
  describe("call-response", function () {
    const onSendFrame = vi.fn();
    const caller = new CallerCore({ sendFrame: onSendFrame });
    afterEach(() => {
      onSendFrame.mockReset();
    });
    test("call-return", async function () {
      const args = [1, "ab", null];
      const res = caller.call(...args);

      expect(onSendFrame.mock.calls[0][0], "call frame").toEqual({ type: FrameType.call, args } satisfies CallerFrame);

      caller.onFrame({ type: FrameType.return, value: 98 } satisfies CalleeFrame);
      await expect(res, "return").resolves.toBe(98);
    });
    test("call-throw", async function () {
      const res = caller.call();
      caller.onFrame({ type: FrameType.throw, value: "throw-value" } satisfies CalleeFrame);
      await expect(res, "return").rejects.toBe("throw-value");
    });
    test("call-resolve", async function () {
      const res = caller.call();
      caller.onFrame({ type: FrameType.promise, id: 32 } satisfies CalleeFrame);
      caller.onFrame({ type: FrameType.resolve, id: 32, value: "abc" } satisfies CalleeFrame);
      await expect(res, "return").resolves.toBe("abc");
    });
    test("call-reject", async function () {
      const res = caller.call();
      caller.onFrame({ type: FrameType.promise, id: 32 } satisfies CalleeFrame);
      caller.onFrame({ type: FrameType.reject, id: 32, value: "abc" } satisfies CalleeFrame);
      await expect(res, "return").rejects.toBe("abc");
    });
  });
  describe("状态更改", function () {
    const onSendFrame = vi.fn();
    const sendFrameMock = onSendFrame.mock;
    let caller: CallerCore;
    const onDisable = vi.fn();
    const onFinish = vi.fn();
    beforeEach(() => {
      onSendFrame.mockReset();
      onDisable.mockReset();
      onFinish.mockReset();
      caller = new CallerCore({ sendFrame: onSendFrame });

      caller.disableEvent.then(onDisable);
      caller.finishEvent.then(onFinish);
    });
    describe("end", function () {
      test("end()", async function () {
        expect(caller.ended).toBe(0);

        const r1 = caller.call(0); //发起一个调用

        caller.end();
        expect(caller.ended).toBe(1);
        expect(caller.waitingNum).toBe(1);

        expect(sendFrameMock.calls[1][0], "发送 end 帧").toEqual({ type: FrameType.end } satisfies Frame.End);

        expect(onDisable).not.toBeCalled();
        expect(onFinish).not.toBeCalled();
        caller.onFrame({ type: FrameType.promise, id: 2 }); //相应返回 promise
        caller.onFrame({ type: FrameType.disable }); // finish 帧

        expect(caller.ended).toBe(2);
        expect(onDisable, "收到 finish 帧后触发 onEnd 事件").toBeCalled();
        expect(onFinish).not.toBeCalled();
        expect(caller.disableEvent.done).toBeTruthy();

        caller.onFrame({ type: FrameType.resolve, id: 2, value: "r1" }); // r1 resolve
        expect(onFinish, "队列清空后触发 close").toBeCalled();
        expect(caller.finishEvent.done).toBeTruthy();
        await expect(r1).resolves.toBe("r1");
      });
      test("end(true)", async function () {
        expect(caller.ended).toBe(0);

        const r1 = caller.call(0); //发起一个调用
        caller.onFrame({ type: FrameType.promise, id: 0 }); //返回Promise id
        const r2 = caller.call(1); //发起另一个调用

        caller.dispose();
        expect(caller.waitingNum, "等待队列被清空").toBe(0);
        expect(caller.ended).toBe(3);

        expect(onDisable).toBeCalledTimes(1);
        expect(onFinish).toBeCalledTimes(1);
        await expect(r1).rejects.toThrowError();
        await expect(r2).rejects.toThrowError();

        caller.onFrame({ type: FrameType.return, value: 2 }); //r2 的返回帧，应被丢弃
        caller.onFrame({ type: FrameType.disable }); //应被丢弃
        caller.onFrame({ type: FrameType.resolve, id: 2, value: "r1" }); //r1的resolve 帧应被丢弃

        expect(onDisable).toBeCalledTimes(1);
        expect(onFinish).toBeCalledTimes(1);
      });
    });

    test("错误的响应", async function () {
      caller.onFrame({ type: FrameType.return, value: "value" }); //不存在的返回值"
      caller.onFrame({ type: FrameType.throw, value: "value" });
      caller.onFrame({ type: FrameType.promise, id: 2 });
      caller.onFrame({ type: FrameType.resolve, id: 1, value: "a" });
      caller.onFrame({ type: FrameType.reject, id: 2, value: "b" });

      const r1 = caller.call();
      const r2 = caller.call();
      caller.onFrame({ type: FrameType.promise, id: 1 });
      caller.onFrame({ type: FrameType.promise, id: 1 });
      await expect(r2).rejects.toThrowError();
      caller.onFrame({ type: FrameType.resolve, id: 1, value: "r1" });
      caller.dispose();

      await expect(r1).resolves.toBe("r1");
    });
  });
});
describe("callee", function () {
  const onSendFrame = vi.fn();
  const onCall = vi.fn();
  const onFinish = vi.fn();
  // const onDisable = vi.fn();
  const sendMock = onSendFrame.mock;

  let callee: CalleeCore;

  beforeEach(() => {
    callee = new CalleeCore({ sendFrame: onSendFrame }, onCall);
    onSendFrame.mockReset();
    onCall.mockReset();

    onFinish.mockReset();
    // onDisable.mockReset();
    callee.finishEvent.then(onFinish);
    // callee.$disable.on(onDisable);
  });
  describe("call-response", function () {
    test("call-return", async function () {
      onCall.mockImplementation((...args) => args);

      const args = [1, "ab", null];
      callee.onFrame({ type: FrameType.call, args });

      expect(sendMock.calls[0][0], "return").toEqual({ type: FrameType.return, value: args } satisfies Frame.Return);
    });
    test("call-throw", async function () {
      const err = new Error("err");

      onCall.mockImplementation((...args) => {
        throw err;
      });

      callee.onFrame({ type: FrameType.call, args: [] });

      const throwFrame: Frame.Throw = sendMock.calls[0][0];
      expect(throwFrame.type).toBe(FrameType.throw);
      expect(throwFrame.value).toBeInstanceOf(Error);
    });
    test("call-resolve", async function () {
      onCall.mockImplementation(async (...args) => args);

      const args = [1, "ab"];
      callee.onFrame({ type: FrameType.call, args });
      const id = 0;
      expect(sendMock.calls[0][0], "promise").toEqual({ type: FrameType.promise, id } satisfies Frame.ReturnPromise);
      await afterTime();

      expect(sendMock.calls[1][0], "resolve").toEqual({
        type: FrameType.resolve,
        id,
        value: args,
      } satisfies Frame.Resolve);
    });
    test("call-reject", async function () {
      onCall.mockImplementation((...args) => Promise.reject(args));

      const args = [1, "ab"];
      callee.onFrame({ type: FrameType.call, args });
      const id = 0;
      expect(sendMock.calls[0][0], "promise").toEqual({ type: FrameType.promise, id } satisfies Frame.ReturnPromise);
      await afterTime();

      expect(sendMock.calls[1][0], "reject").toEqual({
        type: FrameType.reject,
        id,
        value: args,
      } satisfies Frame.Reject);
    });
  });
  describe("disable", function () {
    test("disable()", function () {
      callee.disable();
      // expect(onDisable).toBeCalled();
      expect(callee.disable).toBeTruthy();
      // expect(callee.$disable.done).toBeTruthy();

      //不存在返回队列自动结束
      expect(onFinish).toBeCalled();
      expect(callee.finishEvent.done).toBeTruthy();
    });
  });
});
