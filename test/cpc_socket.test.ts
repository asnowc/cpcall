import { createSocketCpc } from "#rt/node.js";
import { describe, it, expect, vi, SpyInstance } from "vitest";
import { Readable } from "stream";
import {
    createConnectedFcp,
    getInitedStateConnectedCpc,
    getReadable,
    nextMacaoTask,
    createConnectedSocket,
    CpcSocketMocks,
} from "./__mocks__/cpc_socket.mock.js";

import { cpc } from "./__mocks__/cpc.cases.js";
import { Cpc } from "#rt/cpc.js";
describe("cpc", cpc(new CpcSocketMocks()));

it("握手不通过", async function () {
    const { clientSocket, serverSocket } = createConnectedSocket();
    let cpc = createSocketCpc(clientSocket);
    let onError = vi.fn();
    cpc.on("error", onError);

    serverSocket.write(Buffer.from([0, 0, 3, 3]));
    await nextMacaoTask();
    expect(clientSocket.closed);
    expect(onError).toBeCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
});

describe.skip("传递流/cpc_socket", function () {
    function send(stream: Readable, count: number, speed = 10) {
        return new Promise<void>(function (resolve, reject) {
            const id = setInterval(() => {
                if (count <= 0) {
                    clearInterval(id);
                    stream.push(null);
                    resolve();
                } else {
                    count--;
                    stream.push("a");
                }
            }, speed);
        });
    }
    it("传递流", async function () {
        const { cpcServer, cpcClient, onErr } = createConnectedFcp();
        const fn = vi.fn();
        cpcServer.setCmd("cmd", fn);
        let stream = getReadable();
        cpcClient.call("cmd", [stream]);
        await send(stream, 10);

        let arg = fn.mock.calls[0][0] as Readable;
        expect(arg.readableLength).toBe(10);
        expect(arg.read().toString()).toBe("a".repeat(10));
    });
}, 2000);

describe.concurrent("状态更改/cpc_socket", function () {
    function expectFcpClose(cpc: Cpc, closeFn: SpyInstance) {
        expect(closeFn).toBeCalledTimes(1);
        expect(cpc.closed).toBeTruthy();
    }
    it("有等待结束状态执行end()", async function () {
        const { c, s } = getInitedStateConnectedCpc();

        s.cpc.setCmd("cmd", () => new Promise((resolve) => setTimeout(() => resolve(7), 100)));
        const pms = c.cpc.call("cmd");
        c.cpc.end();
        await nextMacaoTask();

        expect(s.onEnd, "serverEnd").toBeCalledTimes(1);
        expect(c.onEnd, "clientEnd").toBeCalledTimes(1);
        expect(s.onClose, "serverNotClose").not.toBeCalled();
        expect(c.onClose, "clientNotClose").not.toBeCalled();

        expect(s.cpc.closed, "未关闭").toBeFalsy();

        await expect(pms).resolves.toBe(7);

        expect(s.onClose, "serverClose").toBeCalled();
        expect(c.onClose, "clientClose").toBeCalled();
    });
    it("外部Duplex end()", async function () {
        const { s, c } = getInitedStateConnectedCpc();

        c.socket.end();
        await nextMacaoTask();

        expect(c.onEnd).toBeCalledTimes(1);
        expectFcpClose(c.cpc, c.onClose);
        expectFcpClose(s.cpc, s.onClose);
        expect(s.socket.destroyed).toBeTruthy();
        expect(c.socket.destroyed).toBeTruthy();
    });
    it("外部Duplex 销毁", async function () {
        const { s, c } = getInitedStateConnectedCpc();

        c.socket.destroy();
        await nextMacaoTask();

        expect(c.onEnd).toBeCalledTimes(1);
        expect(s.onEnd).toBeCalledTimes(1);

        expectFcpClose(c.cpc, c.onClose);
        expectFcpClose(s.cpc, s.onClose);
        expect(s.socket.destroyed).toBeTruthy();
        expect(c.socket.destroyed).toBeTruthy();
    });
});
