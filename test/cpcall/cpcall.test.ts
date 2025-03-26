import { describe, expect, vi, beforeEach } from "vitest";
import { RemoteCallError, ServiceStatus } from "cpcall";
import * as mocks from "../__mocks__/cpc_socket.mock.ts";
import { cpcTest as test } from "../env/cpc.env.ts";

/** 测试返回顺序 */
test("同步连续调用，反回顺序应和调用顺序一致", async function ({ cpcSuite: { cpc1, cpc2 } }) {
  let i = 0;
  cpc2.exposeObject({ fn: vi.fn(() => i++) });
  const pmsList: Promise<any>[] = new Array(3).fill(0).map((arg) => cpc1.call("fn"));
  const res = await Promise.all(pmsList);
  expect(res).toEqual([0, 1, 2]);
});
test("允许交叉调用对方", async function ({ cpcSuite: { cpc1, cpc2 } }) {
  let pms: Promise<any>;
  cpc2.exposeObject({
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
    mock.serverCpc.exposeObject({ [cmd]: fn });
    fn.mockRestore();
  });

  test("调用 3 次", async function () {
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
  test("远程函数抛出 Error 对象，本地端应抛出 RemoteCallError", async function () {
    const { clientCpc, serverCpc } = mock;
    fn.mockImplementation(() => {
      throw new Error("yy");
    });
    await expect(clientCpc.call("fn"), "message 与远程抛出的异常一致").rejects.toThrowError("yy");
    await expect(clientCpc.call("fn")).rejects.toBeInstanceOf(RemoteCallError);
  });
  test("远程函数抛出非 Error 对象，本地端应抛出原始值", async function () {
    const { clientCpc, serverCpc } = mock;
    fn.mockImplementation(() => {
      throw "abc";
    });
    await expect(clientCpc.call("fn")).rejects.toBe("abc");
  });
  test("远程异步函数抛出 Error 对象，本地端应抛出 RemoteCallError", async function () {
    const { clientCpc, serverCpc } = mock;
    fn.mockImplementation(async () => {
      throw new Error("yy");
    });
    await expect(clientCpc.call("fn")).rejects.toThrowError("yy");
    await expect(clientCpc.call("fn")).rejects.toBeInstanceOf(RemoteCallError);
  });
  test("远程异步函数抛出非 Error 对象，本地端应抛出 RemoteCallError", async function () {
    const { clientCpc, serverCpc } = mock;
    fn.mockImplementation(async () => {
      throw "abc";
    });
    await expect(clientCpc.call("fn")).rejects.toBe("abc");
  });
}, 500);

test("Alice 调用 endServe() 后, Bob 继续尝试发起调用将会抛出异常", async function ({ cpcSuite }) {
  const { cpc1: Alice, cpc2: Bob, cpc1Src, cpc2Src } = cpcSuite;

  Alice.exposeObject({ cmd: () => 1 });
  Bob.exposeObject({ cmd: () => 2 });
  await Alice.endServe();

  expect(cpc1Src.close).not.toBeCalled();
  expect(cpc2Src.close).not.toBeCalled();

  expect(Alice.callable).toBeTruthy();
  expect(Bob.callable, "Bob 将不能再发起调用").toBeFalsy();
  await expect(Bob.call("cmd"), "Bob call Alice 将会被拒绝").rejects.toThrowError();
  await expect(Alice.call("cmd"), "Alice 可以继续 call Bob").resolves.toBe(2);

  expect(Bob.serviceStatus).toBe(ServiceStatus.serving);
});
test("Bob 调用 endCall() 后, Bob 继续尝试发起调用将会抛出异常", async function ({ cpcSuite }) {
  const { cpc1: Alice, cpc2: Bob, cpc1Src: ALiceSrc, cpc2Src: BobSrc } = cpcSuite;

  Alice.exposeObject({ cmd: () => 1 });
  Bob.exposeObject({ cmd: () => 2 });

  await Bob.endCall();

  expect(ALiceSrc.close).not.toBeCalled();
  expect(BobSrc.close).not.toBeCalled();

  expect(Bob.callable, "Bob 不能再继续发起调用").toBeFalsy();
  expect(Alice.callable).toBeTruthy();

  await expect(Bob.call("cmd"), "Bob 尝试 call Alice 将抛出异常").rejects.toThrowError();
  await expect(Alice.call("cmd")).resolves.toBe(2);

  expect(Bob.serviceStatus).toBe(ServiceStatus.serving);
});
test("双方调用 endCall() 将触发连接关闭", async function ({ cpcSuite }) {
  const { cpc1, cpc2, cpc1Src, cpc2Src } = cpcSuite;

  const clientFinish = cpc1.endCall();
  const serverFinish = cpc2.endCall();

  await expect(cpc1.onClose).resolves.toBeUndefined();
  await expect(cpc2.onClose).resolves.toBeUndefined();
  expect(cpc1.closed).toBeTruthy();
  expect(cpc2.closed).toBeTruthy();
  expect(cpc1Src.close).toBeCalledTimes(1);
  expect(cpc2Src.close).toBeCalledTimes(1);
});
test("双方调用 endServe() 将触发连接关闭", async function ({ cpcSuite }) {
  const { cpc1, cpc2, cpc1Src, cpc2Src } = cpcSuite;
  const serverFinish = cpc2.endServe();
  const clientFinish = cpc1.endServe();

  await expect(cpc1.onClose).resolves.toBeUndefined();
  await expect(cpc2.onClose).resolves.toBeUndefined();
  expect(cpc1.closed).toBeTruthy();
  expect(cpc2.closed).toBeTruthy();
  expect(cpc1Src.close).toBeCalledTimes(1);
  expect(cpc2Src.close).toBeCalledTimes(1);
});

test("单方调用 close() 将触发连接关闭", async function ({ cpcSuite }) {
  const { cpc1, cpc2, cpc1Src, cpc2Src } = cpcSuite;
  await cpc1.close();
  expect(cpc1.closed).toBeTruthy();
  await expect(cpc1.onClose).resolves.toBeUndefined();

  expect(cpc2.closed).toBeTruthy();
  await expect(cpc2.onClose).resolves.toBeUndefined();
  expect(cpc1Src.close).toBeCalledTimes(1);
  expect(cpc2Src.close).toBeCalledTimes(1);
});
test("单方调用 dispose() 将触发连接断开", async function ({ cpcSuite }) {
  const { cpc1, cpc2, cpc1Src, cpc2Src } = cpcSuite;
  const error = new Error("主动dispose");
  cpc1.dispose(error);

  await Promise.all([cpc1.onClose, cpc2.onClose]);
  expect(cpc1.closed).toBeTruthy();

  expect(cpc1Src.close).not.toBeCalled();
  expect(cpc2Src.close).not.toBeCalled();
  expect(cpc1Src.dispose).toBeCalledTimes(1);
  expect(cpc1Src.dispose).toBeCalledWith(error);
  expect(cpc2Src.dispose).toBeCalledTimes(1);
});
