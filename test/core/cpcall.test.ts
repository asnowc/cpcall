import { describe, test, expect, vi, beforeEach } from "vitest";
import { FrameType, RpcFrame, CpCall, RpcFrameCtrl } from "cpcall";
import { PassiveDataCollector } from "evlib/async";
import { afterTime } from "evlib";
import { CpcFailRespondError, CpcFailAsyncRespondError } from "cpcall";
import * as mocks from "../__mocks__/cpc_socket.mock.js";

describe("CpCall", function () {
  const onSendFrame = vi.fn();
  let hd: PassiveDataCollector<RpcFrame>;
  let cpc: CpCall;
  beforeEach(() => {
    hd = new PassiveDataCollector<RpcFrame>();
    cpc = new CpCall({ frameIter: hd.getAsyncGen(), sendFrame: onSendFrame });
  });
  test("close caller 和 callee 主动触发", async function () {
    cpc.caller.end(true);
    cpc.disable(true);
    hd.yield([FrameType.call, []]);
    await afterTime();
    expect(cpc.closeEvent.done).toBeTruthy();
  });
  test("被动触发", async function () {
    hd.yield([FrameType.end]);
    hd.yield([FrameType.disable]);
    await afterTime();
    expect(cpc.caller.finishEvent.done, "caller finish").toBeTruthy();
    hd.close();
    await afterTime();
    expect(cpc.closeEvent.done, "cpc close").toBeTruthy();
  });
}, 500);

describe("创建连接与关闭连接", function () {
  let mock!: ReturnType<typeof mocks.createConnectedCpc>;
  beforeEach(() => {
    mock = mocks.createConnectedCpc();
  });
  test("caller 关闭", async function () {
    const { clientCpc, serverCpc } = mock;
    const clientFinish = clientCpc.caller.end();
    await clientCpc.caller.disableEvent.getPromise();
    const serverFinish = serverCpc.caller.end();
    await serverCpc.caller.disableEvent.getPromise();
    await Promise.all([clientFinish, serverFinish]);
  });
  test("callee 关闭", async function () {
    const { clientCpc, serverCpc } = mock;
    const serverFinish = serverCpc.disable();
    await clientCpc.caller.disableEvent.getPromise();
    const clientFinish = clientCpc.disable();
    await serverCpc.caller.disableEvent.getPromise();
    await Promise.all([clientFinish, serverFinish]);
  });
  test("单方中断", async function () {
    const { clientCpc, serverCpc } = mock;
    const c1 = clientCpc.closeEvent.getPromise();
    const s1 = serverCpc.closeEvent.getPromise();
    clientCpc.disable(true);
    clientCpc.caller.end(true);
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
      expect(serverCpc.callee.promiseNum).toBe(0);
    });

    test("多个异步返回", async function () {
      const { clientCpc, serverCpc } = mock;
      let count = 0;
      fn.mockImplementation(() => Promise.resolve(count++));
      const caller = clientCpc.caller;
      await expect(caller.call("fn")).resolves.toBe(0);
      expect(serverCpc.callee.promiseNum).toBe(0);
      await expect(caller.call("fn")).resolves.toBe(1);
      expect(serverCpc.callee.promiseNum).toBe(0);
      await expect(caller.call("fn")).resolves.toBe(2);
      expect(serverCpc.callee.promiseNum).toBe(0);
    });
  });

  test("函数抛出Error对象", async function () {
    const { clientCpc, serverCpc } = mock;
    fn.mockImplementation(() => {
      throw new Error("yy");
    });
    await expect(clientCpc.caller.call("fn")).rejects.toThrowError("yy");
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
  });
  test("异步抛出非Error对象", async function () {
    const { clientCpc, serverCpc } = mock;
    fn.mockImplementation(async () => {
      throw "abc";
    });
    await expect(clientCpc.caller.call("fn")).rejects.toBe("abc");
  });
}, 500);

describe("状态更改", function () {
  test("在返回前断开连接", async function () {
    const cpc = mocks.getNoResponseCpc();
    const pms = cpc.caller.call("yyy");
    await afterTime(50);
    cpc.caller.end(true);
    expect(cpc.caller.finishEvent.done).toBeTruthy();
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
    clientCpc.caller.end(true);
    expect(clientCpc.caller.finishEvent.done).toBeTruthy();

    await expect(pms).rejects.toThrowError(CpcFailAsyncRespondError);
  });
  test("数据源实例发生异常后不能调用 sendFrame", async function () {
    const err = new Error("源发生异常");
    class Ctrl implements RpcFrameCtrl {
      frameIter = this.getAsyncGen();
      dispose(): void | Promise<void> {}
      sendFrame = vi.fn();
      private async *getAsyncGen(): AsyncGenerator<RpcFrame> {
        throw err;
      }
    }
    const ctrl = new Ctrl();
    const cpcall = new CpCall(ctrl);

    await expect(cpcall.closeEvent.getPromise()).rejects.toBe(err);
    expect(ctrl.sendFrame).not.toBeCalled();
  });
}, 500);
