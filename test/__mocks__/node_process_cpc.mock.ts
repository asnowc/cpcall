import { Readable } from "node:stream";
import { NodeProcessCpc } from "#rt/node_process_cpc.js";
import { vi } from "vitest";
import { EventEmitter } from "node:events";

interface NodeProcess extends EventEmitter {
    send?(data: any): boolean;
}

/** 模拟只发送数据，永远没有数据返回的场景*/
export function getNoResponseCpc() {
    const clientSocket: NodeProcess = new EventEmitter();
    clientSocket.send = () => true;
    return new NodeProcessCpc(clientSocket);
}
/** 模拟两个已建立连接的 Socket */
export function createConnectedSocket() {
    const serverSocket: NodeProcess = new EventEmitter();
    const clientSocket: NodeProcess = new EventEmitter();
    serverSocket.send = (data) => {
        setTimeout(() => clientSocket.emit("message", data));
        return true;
    };
    clientSocket.send = (data) => {
        setTimeout(() => serverSocket.emit("message", data));
        return true;
    };

    return { serverSocket, clientSocket };
}
/** 模拟两个已连接的 CpcSocket */
export function createConnectedFcp(
    setClientCmd?: Record<string, (...args: any[]) => any>,
    setServerCmd?: Record<string, (...args: any[]) => any>
) {
    const { clientSocket, serverSocket } = createConnectedSocket();
    const cpcServer = new NodeProcessCpc(serverSocket);
    const cpcClient = new NodeProcessCpc(clientSocket);
    const onErr = vi.fn();
    cpcClient.on("error", onErr);
    cpcServer.on("error", onErr);
    (cpcClient as any).name = "client";
    (cpcServer as any).name = "server";

    if (setClientCmd) {
        let cpc = cpcClient;
        for (const [cmd, fn] of Object.entries(setClientCmd)) cpc.setCmd(cmd, fn);
    }
    if (setServerCmd) {
        let cpc = cpcServer;
        for (const [cmd, fn] of Object.entries(setServerCmd)) cpc.setCmd(cmd, fn);
    }

    return { cpcServer, cpcClient, serverSocket, clientSocket, onErr };
}

/** 模拟两个已建立连接的 Socket, 并初始化监听他们的 end、close 事件 */
export function getInitedStateConnectedCpc() {
    const { cpcClient, cpcServer, clientSocket, onErr, serverSocket } = createConnectedFcp();

    const c = {
        onEnd: vi.fn(),
        onClose: vi.fn(),
        cpc: cpcClient,
        socket: clientSocket,
    };
    const s = {
        onEnd: vi.fn(),
        onClose: vi.fn(),
        cpc: cpcServer,
        socket: serverSocket,
    };

    cpcClient.on("end", c.onEnd);
    cpcClient.on("close", c.onClose);

    cpcServer.on("end", s.onEnd);
    cpcServer.on("close", s.onClose);
    return { s, c, onErr };
}

export function getReadable() {
    return new Readable({ read(size) {} });
}
export function nextMacaoTask(time?: number) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
