import { test as vtTest, expect, vi } from "vitest";
import { CpCall, CpcFrameSource, FrameType } from "cpcall";
import { afterTime } from "evlib";
import { MockCpcFrameSource } from "../__mocks__/CpcMockControl.ts";

interface CpcTestContext {
  cpc: CpCall;
  ctrl: MockCpcFrameSource;
}
const test = vtTest.extend<CpcTestContext>({
  async cpc({ ctrl }, use) {
    return use(new CpCall(ctrl));
  },
  async ctrl({}, use) {
    return use(new MockCpcFrameSource());
  },
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
test("主动正常关闭", async function ({ cpc, ctrl }) {
  setTimeout(() => ctrl.nextFrame({ type: FrameType.end }));
  await cpc.disable();
  setTimeout(() => ctrl.nextFrame({ type: FrameType.disable }));
  await cpc.caller.end();

  // 下面的帧应该被忽略
  ctrl.nextFrame({ type: FrameType.exec, args: [] });
  ctrl.nextFrame({ type: FrameType.call, args: [] });
  ctrl.nextFrame({ type: FrameType.end });
  ctrl.nextFrame({ type: FrameType.disable });
  ctrl.endFrame(new Error("被忽略的异常"));
  ctrl.endFrame(new Error("被忽略的异常"));

  await afterTime();

  expect(ctrl.close).toBeCalledTimes(1);
  expect(ctrl.dispose).toBeCalledTimes(0);
  ctrl.nextFrame({ type: FrameType.call, args: ["abc"] }); //传一些错误的帧
  expect(cpc.closeEvent.done).toBeTruthy();
});

test("主动调用 dispose()", async function ({ cpc, ctrl }) {
  const err = new Error("主动调用dispose");
  cpc.dispose(err);

  // 下面的帧应该被忽略
  ctrl.nextFrame({ type: FrameType.exec, args: [] });
  ctrl.nextFrame({ type: FrameType.call, args: [] });
  ctrl.nextFrame({ type: FrameType.end });
  ctrl.nextFrame({ type: FrameType.disable });
  ctrl.endFrame(new Error("被忽略的异常"));
  ctrl.endFrame(new Error("被忽略的异常"));

  expect(ctrl.close).toBeCalledTimes(0);
  expect(ctrl.dispose).toBeCalledTimes(1);
  expect(ctrl.dispose).toBeCalledWith(err);
  ctrl.close();
});

test("source 异常", function ({ cpc, ctrl }) {
  const closeEvent = cpc.closeEvent.getPromise();
  const error = new Error("source error");
  ctrl.endFrame(error);
  expect(closeEvent).rejects.toThrowError(error);

  // 下面的帧应该被忽略
  ctrl.nextFrame({ type: FrameType.exec, args: [] });
  ctrl.nextFrame({ type: FrameType.call, args: [] });
  ctrl.nextFrame({ type: FrameType.end });
  ctrl.nextFrame({ type: FrameType.disable });
  ctrl.endFrame(new Error("被忽略的异常"));
  ctrl.endFrame(new Error("被忽略的异常"));

  expect(ctrl.dispose).toBeCalledWith(error);
  expect(ctrl.close).not.toBeCalled();
});
