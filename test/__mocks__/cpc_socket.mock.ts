import { Duplex, Readable } from "node:stream";
import { createSocketCpc } from "cpcall/node";
import { vi } from "vitest";
import { CpcMocks } from "./cpc.mock.js";
import { Cpc } from "cpcall";
export class CpcSocketMocks extends CpcMocks {
    createConnectedFcp(
        setClientCmd?: Record<string, (...args: any[]) => any> | undefined,
        setServerCmd?: Record<string, (...args: any[]) => any> | undefined
    ): { cpcServer: Cpc; cpcClient: Cpc; onErr: () => void } {
        return createConnectedFcp(setClientCmd, setServerCmd);
    }
    getNoResponseCpc(): Cpc {
        return getNoResponseCpc();
    }
}

/** 模拟只发送数据，永远没有数据返回的场景*/
export function getNoResponseCpc() {
    const clientSocket = new Duplex({
        write(_, _1, callback) {
            callback();
        },
        read(size) {},
        final(callback) {
            callback();
        },
    });
    return createSocketCpc(clientSocket);
}
/** 模拟两个已连接的 CpcSocket */
export function createConnectedFcp(
    setClientCmd?: Record<string, (...args: any[]) => any>,
    setServerCmd?: Record<string, (...args: any[]) => any>
) {
    const { clientSocket, serverSocket } = createConnectedSocket();
    const cpcServer = createSocketCpc(serverSocket);
    const cpcClient = createSocketCpc(clientSocket);
    const onErr = vi.fn();
    cpcClient.$error.on(onErr);
    cpcServer.$error.on(onErr);
    if (setClientCmd) {
        let cpc = cpcClient;
        for (const [cmd, fn] of Object.entries(setClientCmd)) cpc.setCmd(cmd, fn);
    }
    if (setServerCmd) {
        let cpc = cpcServer;
        for (const [cmd, fn] of Object.entries(setServerCmd)) cpc.setCmd(cmd, fn);
    }
    (cpcClient as any).name = "client";
    (cpcServer as any).name = "server";
    return { cpcServer, cpcClient, serverSocket, clientSocket, onErr };
}
/** 模拟两个已建立连接的 Socket */
export function createConnectedSocket() {
    const serverSocket = new Duplex({
        write(chunk, encoding, callback) {
            clientSocket.push(chunk, encoding);
            callback();
        },
        read(size) {},
        final(callback) {
            clientSocket.push(null);
            callback();
        },
        destroy(error, callback) {
            if (!clientSocket.destroyed) serverSocket.destroy();
            callback(error);
        },
    });
    const clientSocket = new Duplex({
        write(chunk, encoding, callback) {
            serverSocket.push(chunk, encoding);
            callback();
        },
        read(size) {},
        final(callback) {
            serverSocket.push(null);
            callback();
        },
        destroy(error, callback) {
            if (!serverSocket.destroyed) serverSocket.destroy();
            callback(error);
        },
    });
    return { serverSocket, clientSocket };
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

    cpcClient.$end.on(c.onEnd);
    cpcClient.$closed.on(c.onClose);

    cpcServer.$end.on(s.onEnd);
    cpcServer.$closed.on(s.onClose);
    return { s, c, onErr };
}

/**
 * @param sp 以字节为单位分隔
 */
export function bufToHex(buf: Buffer, sp?: number[]) {
    let hex = buf.toString("hex");
    return hexFormat(
        hex,
        sp?.map((byte) => byte * 2)
    );
}
/**
 * @param sp 以长度为单位分隔
 */
export function hexFormat(hex: string, sp?: number[]) {
    let format = "";
    if (sp) {
        let max = sp.length - 1;
        for (let i = 0; i < max; i++) {
            let len = sp[i];
            if (hex.length > len) {
                format += hex.slice(0, len) + " ";
                hex = hex.slice(len);
            } else {
                format += hex;
                return format;
            }
        }
        format += hex;
        return format;
    } else {
        while (hex.length > 4) {
            format += hex.slice(0, 4);
            hex = hex.slice(4);
            if (hex.length) format += " ";
            else break;
        }
        return (format += hex);
    }
}

export function getReadable() {
    return new Readable({ read(size) {} });
}
export function nextMacaoTask(time?: number) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
