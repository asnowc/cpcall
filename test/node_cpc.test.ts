import { CpcFailAsyncRespondError } from "cpcall";
import { describe, test, expect, vi, beforeEach } from "vitest";
import * as mocks from "./__mocks__/cpc_socket.mock.js";
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
    serverCpc.caller.end();
    clientCpc.caller.end();

    await Promise.all([serverCpc.closeEvent.getPromise(), clientCpc.closeEvent.getPromise()]);

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
    expect(serverCpc.closeEvent.done).toBeTruthy();

    expect(clientSocket.closed).toBeTruthy();
    expect(clientCpc.closeEvent.done).toBeTruthy();
  });
  test("外部Duplex 销毁", async function () {
    const { serverCpc, clientCpc, clientSocket, serverSocket } = mock;
    const onSafeClose = vi.fn();
    const clientClose = vi.fn();
    const serverClose = vi.fn();
    serverCpc.closeEvent.then(onSafeClose, clientClose);
    clientCpc.closeEvent.then(onSafeClose, serverClose);
    // const err = new Error("外部Duplex 销毁");
    clientSocket.destroy();
    await afterTime();

    expect(serverSocket.destroyed, "server socket 已销毁").toBeTruthy();
    expect(clientSocket.destroyed, "client socket 已销毁").toBeTruthy();

    expect(serverClose.mock.calls[0][0]).instanceof(Error);
    expect(clientClose.mock.calls[0][0]).instanceof(Error);
    expect(clientCpc.closeEvent.done).toBeTruthy();
    expect(serverCpc.closeEvent.done).toBeTruthy();
  });
  test("有等待响应,但对方已销毁流", async function () {
    const { serverCpc, clientCpc, clientSocket, serverSocket } = mock;
    serverCpc.setFn("neverRespond", () => new Promise(() => {}));
    const res = clientCpc.caller.call("neverRespond").catch((e) => e instanceof CpcFailAsyncRespondError);
    await afterTime();
    clientSocket.destroy(new Error("aaa")); //客户端未等待服务端响应, 直接销毁流

    await afterTime();
    expect(clientSocket.destroyed).toBeTruthy();
    expect(serverSocket.destroyed).toBeTruthy();

    expect(serverCpc.closeEvent.done).toBeTruthy();
    expect(clientCpc.closeEvent.done).toBeTruthy();

    await expect(res).resolves.toBe(true);
  });
}, 500);
