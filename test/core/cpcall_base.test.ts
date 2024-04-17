import { describe, test, expect, vi, beforeEach } from "vitest";
import { RpcFrame, CpCall, RpcFrameCtrl, FrameType } from "cpcall";
import { PassiveDataCollector } from "evlib/async";
import { afterTime } from "evlib";

let hd: PassiveDataCollector<RpcFrame>;
let cpc: CpCall;
let ctrl: RpcFrameCtrl<RpcFrame>;
beforeEach(() => {
  hd = new PassiveDataCollector<RpcFrame>();
  ctrl = { frameIter: hd.getAsyncGen(), sendFrame: vi.fn(), close: vi.fn(), dispose: vi.fn() };
  cpc = new CpCall(ctrl);
});
describe("正常关闭", function () {
  test("主动正常关闭", async function () {
    setTimeout(() => hd.yield([FrameType.end]));
    await cpc.disable();
    setTimeout(() => hd.yield([FrameType.disable]));
    await cpc.caller.end();
    await afterTime();
    expect(ctrl.close).toBeCalledTimes(1);
    expect(ctrl.dispose).toBeCalledTimes(0);
    hd.yield([FrameType.call, ["abc"]]); //传一些错误的帧
    hd.close();
  });
}, 500);

describe("异常关闭", function () {
  test("主动调用 dispose()", async function () {
    const err = new Error("主动调用dispose");
    await cpc.dispose(err);
    hd.yield([FrameType.call, ["abc"]]); //传一些错误的帧
    expect(ctrl.close).toBeCalledTimes(0);
    expect(ctrl.dispose).toBeCalledTimes(1);
    expect(ctrl.dispose).toBeCalledWith(err);
    hd.close();
  });
}, 500);
