import { NodeProcessCpc } from "#rt/node_process_cpc.js";
import { vi } from "vitest";
import { EventEmitter } from "node:events";
import { Cpc, CpcCallList } from "#rt/cpc.js";
import { CpcMocks } from "./cpc.mock.js";

export class PsCpcMocks extends CpcMocks {
    createConnectedFcp(
        setClientCmd?: Record<string, (...args: any[]) => any> | undefined,
        setServerCmd?: Record<string, (...args: any[]) => any> | undefined
    ): { cpcServer: Cpc<CpcCallList, CpcCallList>; cpcClient: Cpc<CpcCallList, CpcCallList>; onErr: () => void } {
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

        return { cpcServer, cpcClient, onErr };
    }
    getNoResponseCpc(): Cpc<CpcCallList, CpcCallList> {
        const clientSocket: NodeProcess = new EventEmitter();
        clientSocket.send = () => true;
        return new NodeProcessCpc(clientSocket);
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
