import { describe, expect, vi, beforeEach } from "vitest";
import {
  CallerStatus,
  CpCall,
  RemoteCallError,
  CpcFailRespondError,
  CpcFailAsyncRespondError,
  CpcController,
  FrameType,
} from "cpcall";
import { afterTime } from "evlib";
import * as mocks from "../__mocks__/cpc_socket.mock.ts";
import { MockCpcFrameSource } from "../__mocks__/CpcMockControl.ts";
import { cpcTest as test } from "../env/cpc.env.ts";

/** 测试返回顺序 */
test("连续调用", async function ({ cpcSuite: { cpc1, cpc2 } }) {
  cpc2.setObject({ fn: vi.fn((...args) => args[0]) });
  const dataList = [null, true, false];
  const pmsList: Promise<any>[] = dataList.map((arg) => cpc1.call("fn", arg));
  const res = await Promise.all(pmsList);
  expect(res).toEqual(dataList);
});
test("内联调用", async function ({ cpcSuite: { cpc1, cpc2 } }) {
  let pms: Promise<any>;
  cpc2.setObject({
    clientFn: () => 1,
    serverFn: () => {
      pms = cpc1.call("clientFn", true);
      return 3;
    },
  });
  await expect(cpc1.call("serverFn")).resolves.toBe(3);
  await expect(pms!).resolves.toBe(1);
});
describe("返回值", function () {
  let mock!: ReturnType<typeof mocks.createConnectedCpc>;
  const fn = vi.fn();
  const cmd = "fn";
  beforeEach(() => {
    mock = mocks.createConnectedCpc();
    mock.serverCpc.setObject({ [cmd]: fn });
    fn.mockRestore();
  });

  test("多个异步返回", async function () {
    const { clientCpc, serverCpc } = mock;
    let count = 0;
    fn.mockImplementation(() => Promise.resolve(count++));
    const caller = clientCpc;
    await expect(caller.call("fn")).resolves.toBe(0);
    expect(serverCpc.responsePromiseNum).toBe(0);
    await expect(caller.call("fn")).resolves.toBe(1);
    expect(serverCpc.responsePromiseNum).toBe(0);
    await expect(caller.call("fn")).resolves.toBe(2);
    expect(serverCpc.responsePromiseNum).toBe(0);
  });
  test("函数抛出Error对象", async function () {
    const { clientCpc, serverCpc } = mock;
    fn.mockImplementation(() => {
      throw new Error("yy");
    });
    await expect(clientCpc.call("fn")).rejects.toThrowError("yy");
    await expect(clientCpc.call("fn")).rejects.toBeInstanceOf(RemoteCallError);
  });
  test("函数抛出非Error对象", async function () {
    const { clientCpc, serverCpc } = mock;
    fn.mockImplementation(() => {
      throw "abc";
    });
    await expect(clientCpc.call("fn")).rejects.toBe("abc");
  });
  test("异步抛出Error对象", async function () {
    const { clientCpc, serverCpc } = mock;
    fn.mockImplementation(async () => {
      throw new Error("yy");
    });
    await expect(clientCpc.call("fn")).rejects.toThrowError("yy");
    await expect(clientCpc.call("fn")).rejects.toBeInstanceOf(RemoteCallError);
  });
  test("异步抛出非Error对象", async function () {
    const { clientCpc, serverCpc } = mock;
    fn.mockImplementation(async () => {
      throw "abc";
    });
    await expect(clientCpc.call("fn")).rejects.toBe("abc");
  });
}, 500);

describe("状态更改", function () {
  test("在返回前断开连接", async function () {
    const cpc = mocks.getNoResponseCpc();
    const pms = cpc.call("yyy");
    await afterTime(50);

    const err = new Error("dispose");
    cpc.dispose(err);

    expect(cpc.callerStatus).toBe(CallerStatus.finished);
    const e1 = expect(cpc.onClose).rejects.toThrowError();
    const e2 = expect(pms, "在返回前中断").rejects.toThrowError(CpcFailRespondError);

    await Promise.all([e1, e2]);
  });
  test("Promise状态在变化前断开连接", async function () {
    const { serverCpc, clientCpc } = mocks.createConnectedCpc();
    serverCpc.onClose.catch(() => {});
    clientCpc.onClose.catch(() => {});

    serverCpc.setObject({
      cmd: function () {
        return new Promise(function (resolve) {
          setTimeout(resolve, 500);
        });
      },
    });
    let pms = clientCpc.call("cmd");
    await afterTime(); //等待响应异步 id
    clientCpc.dispose();
    expect(clientCpc.callerStatus).toBe(CallerStatus.finished);

    await expect(pms).rejects.toThrowError(CpcFailAsyncRespondError);
  });
  test("数据源实例发生异常后不能调用 sendFrame", async function () {
    const err = new Error("源发生异常");

    const ctrl = new MockCpcFrameSource();
    const cpcall = new CpCall(ctrl);
    cpcall.dispose(err);
    ctrl.sendFrame.mockRestore();

    await expect(cpcall.onClose).rejects.toBe(err);
    expect(ctrl.sendFrame).not.toBeCalled();
  });
  test("close 异常", async function () {
    const onClose = vi.fn(() => {
      throw new Error("err");
    });
    const onDispose = vi.fn();
    let ctrl: CpcController;
    const cpc = new CpCall({
      dispose: onDispose,
      close: onClose,
      init(controller) {
        ctrl = controller;
      },
      sendFrame(frame) {},
    });

    ctrl!.nextFrame({ type: FrameType.endCall });
    ctrl!.nextFrame({ type: FrameType.endServe });

    await expect(cpc.onClose).rejects.toThrowError("err");
    expect(onClose).toBeCalledTimes(1);
    expect(onDispose, "close 无法正常关闭，应调用 dispose").toBeCalledTimes(1);
  });

  test("双方 endCall()", async function ({ cpcSuite }) {
    const { cpc1, cpc2 } = cpcSuite;

    const clientFinish = cpc1.endCall();
    const serverFinish = cpc2.endCall();

    await expect(cpc1.onClose).resolves.toBeUndefined();
    await expect(cpc2.onClose).resolves.toBeUndefined();
  });
  test("双方 endServe()", async function ({ cpcSuite }) {
    const { cpc1, cpc2 } = cpcSuite;
    const serverFinish = cpc2.endServe();
    const clientFinish = cpc1.endServe();

    await expect(cpc1.onClose).resolves.toBeUndefined();
    await expect(cpc2.onClose).resolves.toBeUndefined();
  });
  test("单方中断", async function ({ cpcSuite }) {
    const { cpc1, cpc2 } = cpcSuite;
    const c1 = cpc1.onClose;
    const s1 = cpc2.onClose;
    cpc1.close();
    await expect(c1).resolves.toBeUndefined();
    await expect(s1).resolves.toBeUndefined();
  });
  test("单方 close()", async function ({ cpcSuite }) {
    const { cpc1, cpc2 } = cpcSuite;
    await cpc1.close();
    expect(cpc1.closed).toBeTruthy();
    expect(cpc1.onClose).resolves.toBeUndefined();

    expect(cpc2.closed).toBeTruthy();
    expect(cpc2.onClose).resolves.toBeUndefined();
  });
  test("单方 dispose()", async function ({ cpcSuite }) {
    const { cpc1, cpc2 } = cpcSuite;
    const error = new Error("主动dispose");
    cpc1.dispose(error);

    const e1 = expect(cpc1.onClose, "cpc1 抛出异常与 dispose 传入的 异常 一致").rejects.toThrowError(error);
    const e2 = expect(cpc2.onClose, "远程异常关闭").rejects.toThrowError();
    await e1;
    await e2;
    expect(cpc1.closed).toBeTruthy();
  });
}, 500);
