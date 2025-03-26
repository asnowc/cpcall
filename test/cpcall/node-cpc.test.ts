import { describe, test, expect, beforeEach } from "vitest";
import * as mocks from "../__mocks__/cpc_socket.mock.ts";

describe("状态更改/cpc_socket", function () {
  let mock!: ReturnType<typeof mocks.createConnectedCpc>;
  beforeEach(() => {
    mock = mocks.createConnectedCpc();
    mocks.setDuplexEvents(mock.clientSocket);
    mocks.setDuplexEvents(mock.serverSocket);
  });
  test("正常结束 CpCall 应能够正常结束 Duplex 的连接", async function () {
    const { serverCpc, clientCpc, clientSocket, serverSocket } = mock;
    serverCpc.endCall();
    clientCpc.endCall();

    await Promise.all([clientCpc.onClose, serverCpc.onClose]);

    expect(clientSocket.errored).toBeFalsy();
    expect(serverSocket.errored).toBeFalsy();

    expect(clientSocket.readableEnded).toBeTruthy();
    expect(serverSocket.readableEnded).toBeTruthy();

    expect(clientSocket.closed).toBeTruthy();
    expect(serverSocket.closed).toBeTruthy();
  });
  test("外部 Duplex 调用 end() 会关闭 CpCall 的连接", async function () {
    const { serverCpc, clientCpc, clientSocket, serverSocket } = mock;
    clientSocket.end();
    await Promise.all([serverCpc.onClose, serverCpc.onClose]); // 关闭
  });
  test("外部 Duplex 销毁会关闭 CpCall 的连接", async function () {
    const { serverCpc, clientCpc, clientSocket, serverSocket } = mock;
    // const err = new Error("外部Duplex 销毁");
    clientSocket.destroy();

    expect(serverSocket.destroyed, "server socket 已销毁").toBeTruthy();
    expect(clientSocket.destroyed, "client socket 已销毁").toBeTruthy();

    await Promise.all([serverCpc.onClose, serverCpc.onClose]); // 关闭
  });
}, 500);
