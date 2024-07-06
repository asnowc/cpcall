import { CpcFailAsyncRespondError } from "cpcall";
import { describe, test, expect, vi, beforeEach } from "vitest";
import * as mocks from "../__mocks__/cpc_socket.mock.ts";
import { afterTime } from "evlib";

describe("状态更改/cpc_socket", function () {
  let mock!: ReturnType<typeof mocks.createConnectedCpc>;
  let c!: ReturnType<typeof mocks.setDuplexEvents>;
  let s!: ReturnType<typeof mocks.setDuplexEvents>;
  beforeEach(() => {
    mock = mocks.createConnectedCpc();
    c = mocks.setDuplexEvents(mock.clientSocket);
    s = mocks.setDuplexEvents(mock.serverSocket);
  });
  test("安全关闭", async function () {
    const { serverCpc, clientCpc, clientSocket, serverSocket } = mock;
    serverCpc.caller.endCall();
    clientCpc.caller.endCall();

    await Promise.all([serverCpc.onClose.getPromise(), clientCpc.onClose.getPromise()]);

    await afterTime();
    expect(clientSocket.errored).toBeFalsy();
    expect(serverSocket.errored).toBeFalsy();

    expect(clientSocket.readableEnded).toBeTruthy();
    expect(serverSocket.readableEnded).toBeTruthy();

    expect(clientSocket.closed).toBeTruthy();
    expect(serverSocket.closed).toBeTruthy();
  });
  test("外部Duplex end()", async function () {
    const { serverCpc, clientCpc, clientSocket, serverSocket } = mock;

    clientSocket.end();
    await afterTime();
    expect(serverSocket.closed).toBeTruthy();
    expect(serverCpc.onClose.done).toBeTruthy();

    expect(clientSocket.closed).toBeTruthy();
    expect(clientCpc.onClose.done).toBeTruthy();
  });
  test("外部Duplex 销毁", async function () {
    const { serverCpc, clientCpc, clientSocket, serverSocket } = mock;
    const onSafeClose = vi.fn();
    const clientClose = vi.fn();
    const serverClose = vi.fn();
    serverCpc.onClose.then(onSafeClose, clientClose);
    clientCpc.onClose.then(onSafeClose, serverClose);
    // const err = new Error("外部Duplex 销毁");
    clientSocket.destroy();
    await afterTime();

    expect(serverSocket.destroyed, "server socket 已销毁").toBeTruthy();
    expect(clientSocket.destroyed, "client socket 已销毁").toBeTruthy();

    expect(serverClose.mock.calls[0][0]).instanceof(Error);
    expect(clientClose.mock.calls[0][0]).instanceof(Error);
    expect(clientCpc.onClose.done).toBeTruthy();
    expect(serverCpc.onClose.done).toBeTruthy();
  });
  test("有等待响应,但对方已销毁流", async function () {
    const { serverCpc, clientCpc, clientSocket, serverSocket } = mock;
    serverCpc.setFn("neverRespond", () => new Promise(() => {}));
    const err = new Error("aaa");
    const res = clientCpc.caller.call("neverRespond").catch((e) => e);
    await afterTime();
    clientSocket.destroy(err); //客户端未等待服务端响应, 直接销毁流

    await afterTime();
    expect(clientSocket.destroyed, "client socket 销毁").toBeTruthy();
    expect(serverSocket.destroyed, "server socket 销毁").toBeTruthy();

    await afterTime();
    expect(serverCpc.onClose.done, "server emitted close").toBeTruthy();
    expect(clientCpc.onClose.done, "client emitted close").toBeTruthy();

    await expect(res).resolves.toBe(err);
  });
}, 500);
