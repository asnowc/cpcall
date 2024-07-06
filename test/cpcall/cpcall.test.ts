import { describe, test, expect, vi, beforeEach } from "vitest";
import { FrameType, CpCall, RemoteCallError } from "cpcall";
import { afterTime } from "evlib";
import { CpcFailRespondError, CpcFailAsyncRespondError } from "cpcall";
import * as mocks from "../__mocks__/cpc_socket.mock.ts";
import { MockCpcFrameSource } from "../__mocks__/CpcMockControl.ts";

describe("CpCall", function () {
  let hd: MockCpcFrameSource;
  let cpc: CpCall;
  beforeEach(() => {
    hd = new MockCpcFrameSource();
    cpc = new CpCall(hd);
  });
  test("close caller 和 callee 主动触发", async function () {
    cpc.caller.dispose();
    cpc.endServe();
    hd.nextFrame({ type: FrameType.call, args: [] });
    await afterTime();
    expect(cpc.onClose.done).toBeTruthy();
  });
  test("被动触发", async function () {
    hd.nextFrame({ type: FrameType.endCall });
    hd.nextFrame({ type: FrameType.endServe });
    await afterTime();
    expect(cpc.caller.onCallFinish.done, "caller finish").toBeTruthy();
    hd.endFrame();
    await afterTime();
    expect(cpc.onClose.done, "cpc close").toBeTruthy();
  });
}, 500);

describe("创建连接与关闭连接", function () {
  let mock!: ReturnType<typeof mocks.createConnectedCpc>;
  beforeEach(() => {
    mock = mocks.createConnectedCpc();
  });
  test("caller 关闭", async function () {
    const { clientCpc, serverCpc } = mock;
    const clientFinish = clientCpc.caller.endCall();
    await clientCpc.caller.onRemoteServeEnd.getPromise();
    const serverFinish = serverCpc.caller.endCall();
    await serverCpc.caller.onRemoteServeEnd.getPromise();
    await Promise.all([clientFinish, serverFinish]);
  });
  test("callee关闭", async function () {
    const { clientCpc, serverCpc } = mock;
    const serverFinish = serverCpc.endServe();
    await clientCpc.caller.onRemoteServeEnd.getPromise();
    const clientFinish = clientCpc.endServe();

    await Promise.all([clientFinish, serverFinish]);
    expect(serverCpc.caller.onRemoteServeEnd.done).toBeTruthy();
  });
  test("单方中断", async function () {
    const { clientCpc, serverCpc } = mock;
    const c1 = clientCpc.onClose.getPromise();
    const s1 = serverCpc.onClose.getPromise();
    clientCpc.endServe();
    clientCpc.caller.dispose();
    await expect(c1).resolves.toBeUndefined();
    await expect(s1).resolves.toBeUndefined();
  });
}, 500);
describe("与返回调用", function () {
  let mock!: ReturnType<typeof mocks.createConnectedCpc>;
  const fn = vi.fn((...args) => args);
  const cmd = "fn";
  beforeEach(() => {
    mock = mocks.createConnectedCpc();
    mock.serverCpc.setFn(cmd, fn);
    fn.mockRestore();
  });

  /** 测试参数传输 */
  test("单个参数调用与返回值", async function () {
    const { clientCpc } = mock;
    const arg = [1, "ab", null, { a: 2, b: 8n }];
    const res = await clientCpc.caller.call(cmd, ...arg);

    expect(fn).toBeCalledWith(...arg);
    expect(res, "返回值").toEqual(arg);
  });
  /** 测试返回顺序 */
  test("连续调用", async function () {
    const { clientCpc } = mock;
    fn.mockImplementation((...args) => args[0]);
    const dataList = [null, true, false];
    const pmsList: Promise<any>[] = dataList.map((arg) => clientCpc.caller.call(cmd, arg));
    const res = await Promise.all(pmsList);
    expect(res).toEqual(dataList);
  });
  test("exec", async function () {
    const { clientCpc, serverCpc } = mock;
    fn.mockImplementation((...args) => args[0]);
    serverCpc.setFn("fn", fn);
    expect(clientCpc.caller.exec("fn", 77)).toBeUndefined();
  });
  test("内联调用", async function () {
    let pms: Promise<any>;
    const { clientCpc, serverCpc } = mock;
    clientCpc.setFn("clientFn", () => 1);
    serverCpc.setFn("serverFn", () => {
      pms = serverCpc.caller.call("clientFn", true);
      return 3;
    });
    await expect(clientCpc.caller.call("serverFn")).resolves.toBe(3);
    await expect(pms!).resolves.toBe(1);
  });
}, 500);

describe("返回值", function () {
  let mock!: ReturnType<typeof mocks.createConnectedCpc>;
  const fn = vi.fn();
  const cmd = "fn";
  beforeEach(() => {
    mock = mocks.createConnectedCpc();
    mock.serverCpc.setFn(cmd, fn);
    fn.mockRestore();
  });

  describe("异步返回", function () {
    test("异步返回", async function () {
      const { clientCpc, serverCpc } = mock;
      const arg = [true, undefined, 4];
      fn.mockImplementation(async () => {
        return new Promise((resolve) => setTimeout(() => resolve(8)));
      });
      await expect(clientCpc.caller.call("fn", arg)).resolves.toBe(8);
      expect(serverCpc.responsePromiseNum).toBe(0);
    });

    test("多个异步返回", async function () {
      const { clientCpc, serverCpc } = mock;
      let count = 0;
      fn.mockImplementation(() => Promise.resolve(count++));
      const caller = clientCpc.caller;
      await expect(caller.call("fn")).resolves.toBe(0);
      expect(serverCpc.responsePromiseNum).toBe(0);
      await expect(caller.call("fn")).resolves.toBe(1);
      expect(serverCpc.responsePromiseNum).toBe(0);
      await expect(caller.call("fn")).resolves.toBe(2);
      expect(serverCpc.responsePromiseNum).toBe(0);
    });
  });

  test("函数抛出Error对象", async function () {
    const { clientCpc, serverCpc } = mock;
    fn.mockImplementation(() => {
      throw new Error("yy");
    });
    await expect(clientCpc.caller.call("fn")).rejects.toThrowError("yy");
    await expect(clientCpc.caller.call("fn")).rejects.toBeInstanceOf(RemoteCallError);
  });
  test("函数抛出非Error对象", async function () {
    const { clientCpc, serverCpc } = mock;
    fn.mockImplementation(() => {
      throw "abc";
    });
    await expect(clientCpc.caller.call("fn")).rejects.toBe("abc");
  });
  test("异步抛出Error对象", async function () {
    const { clientCpc, serverCpc } = mock;
    fn.mockImplementation(async () => {
      throw new Error("yy");
    });
    await expect(clientCpc.caller.call("fn")).rejects.toThrowError("yy");
    await expect(clientCpc.caller.call("fn")).rejects.toBeInstanceOf(RemoteCallError);
  });
  test("异步抛出非Error对象", async function () {
    const { clientCpc, serverCpc } = mock;
    fn.mockImplementation(async () => {
      throw "abc";
    });
    await expect(clientCpc.caller.call("fn")).rejects.toBe("abc");
  });
}, 500);
test("dispose", async function () {
  const { clientCpc, serverCpc } = mocks.createConnectedCpc();
  const onClose = vi.fn();
  clientCpc.onClose.catch(onClose);
  const error = new Error("主动dispose");
  clientCpc.dispose(error);
  await afterTime();
  expect(clientCpc.onClose.done).toBeTruthy();
  expect(onClose).toBeCalled();
});
describe("状态更改", function () {
  test("在返回前断开连接", async function () {
    const cpc = mocks.getNoResponseCpc();
    const pms = cpc.caller.call("yyy");
    await afterTime(50);
    cpc.caller.dispose();
    expect(cpc.caller.onCallFinish.done).toBeTruthy();
    await expect(pms, "在返回前中断").rejects.toThrowError(CpcFailRespondError);
  });
  test("Promise状态在变化前断开连接", async function () {
    const { serverCpc, clientCpc } = mocks.createConnectedCpc();

    serverCpc.setFn("cmd", function () {
      return new Promise(function (resolve) {
        setTimeout(resolve, 500);
      });
    });
    let pms = clientCpc.caller.call("cmd");
    await afterTime();
    clientCpc.caller.dispose();
    expect(clientCpc.caller.onCallFinish.done).toBeTruthy();

    await expect(pms).rejects.toThrowError(CpcFailAsyncRespondError);
  });
  test("数据源实例发生异常后不能调用 sendFrame", async function () {
    const err = new Error("源发生异常");

    const ctrl = new MockCpcFrameSource();
    const cpcall = new CpCall(ctrl);
    cpcall.dispose(err);

    await expect(cpcall.onClose.getPromise()).rejects.toBe(err);
    expect(ctrl.sendFrame).not.toBeCalled();
  });
}, 500);
