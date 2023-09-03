import { createNodePsCpc } from "cpcall/node";
import { vi } from "vitest";
import { EventEmitter } from "node:events";
import { Cpc } from "cpcall";
import { CpcMocks } from "./cpc.mock.js";

export class PsCpcMocks extends CpcMocks {
    createConnectedFcp(
        setClientCmd?: Record<string, (...args: any[]) => any> | undefined,
        setServerCmd?: Record<string, (...args: any[]) => any> | undefined
    ): { cpcServer: Cpc; cpcClient: Cpc; onErr: () => void } {
        const { clientSocket, serverSocket } = createConnectedSocket();
        const cpcServer = createNodePsCpc(serverSocket);
        const cpcClient = createNodePsCpc(clientSocket);
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

        return { cpcServer, cpcClient, onErr };
    }
    getNoResponseCpc(): Cpc {
        const clientSocket: NodeProcess = new EventEmitter();
        clientSocket.send = () => true;
        return createNodePsCpc(clientSocket);
    }
}

interface NodeProcess extends EventEmitter {
    send?(data: any): boolean;
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
