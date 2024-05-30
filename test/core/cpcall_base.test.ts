import { test, expect, beforeEach, vi } from "vitest";
import { CpCall, CpcFrameSource, FrameType } from "cpcall";
import { afterTime } from "evlib";
import { MockCpcFrameSource } from "../__mocks__/CpcMockControl.ts";
/**
 * 测试 CpcFrameSource
 */

let cpc: CpCall;
let ctrl: MockCpcFrameSource;
beforeEach(() => {
  ctrl = new MockCpcFrameSource();
  cpc = new CpCall(ctrl);
});
test("init 同步被调用", function () {
  const ctrl: CpcFrameSource = {
    init: vi.fn(),
    close: vi.fn(),
    dispose: vi.fn(),
    sendFrame: vi.fn(),
  };
  new CpCall(ctrl);
  expect(ctrl.init).toBeCalled();
});
test("主动正常关闭", async function () {
  setTimeout(() => ctrl.nextFrame([FrameType.end]));
  await cpc.disable();
  setTimeout(() => ctrl.nextFrame([FrameType.disable]));
  await cpc.caller.end();

  // 下面的帧应该被忽略
  ctrl.nextFrame([FrameType.exec, []]);
  ctrl.nextFrame([FrameType.call, []]);
  ctrl.nextFrame([FrameType.end]);
  ctrl.nextFrame([FrameType.disable]);
  ctrl.endFrame(new Error("被忽略的异常"));
  ctrl.endFrame(new Error("被忽略的异常"));

  await afterTime();

  expect(ctrl.close).toBeCalledTimes(1);
  expect(ctrl.dispose).toBeCalledTimes(0);
  ctrl.nextFrame([FrameType.call, ["abc"]]); //传一些错误的帧
  expect(cpc.closeEvent.done).toBeTruthy();
});

test("主动调用 dispose()", async function () {
  const err = new Error("主动调用dispose");
  cpc.dispose(err);

  // 下面的帧应该被忽略
  ctrl.nextFrame([FrameType.exec, []]);
  ctrl.nextFrame([FrameType.call, []]);
  ctrl.nextFrame([FrameType.end]);
  ctrl.nextFrame([FrameType.disable]);
  ctrl.endFrame(new Error("被忽略的异常"));
  ctrl.endFrame(new Error("被忽略的异常"));

  expect(ctrl.close).toBeCalledTimes(0);
  expect(ctrl.dispose).toBeCalledTimes(1);
  expect(ctrl.dispose).toBeCalledWith(err);
  ctrl.close();
});

test("source 异常", function () {
  const closeEvent = cpc.closeEvent.getPromise();
  const error = new Error("source error");
  ctrl.endFrame(error);
  expect(closeEvent).rejects.toThrowError(error);

  // 下面的帧应该被忽略
  ctrl.nextFrame([FrameType.exec, []]);
  ctrl.nextFrame([FrameType.call, []]);
  ctrl.nextFrame([FrameType.end]);
  ctrl.nextFrame([FrameType.disable]);
  ctrl.endFrame(new Error("被忽略的异常"));
  ctrl.endFrame(new Error("被忽略的异常"));

  expect(ctrl.dispose).toBeCalledWith(error);
  expect(ctrl.close).not.toBeCalled();
});
