import { Cpc } from "cpcall";
import { vi } from "vitest";

export abstract class CpcMocks {
    /** 模拟只发送数据，永远没有数据返回的场景*/
    abstract getNoResponseCpc(): Cpc;
    /** 模拟两个已连接的 CpcSocket */
    abstract createConnectedFcp(
        setClientCmd?: Record<string, (...args: any[]) => any>,
        setServerCmd?: Record<string, (...args: any[]) => any>
    ): { cpcServer: Cpc; cpcClient: Cpc; onErr: () => void };
    /** 模拟两个已建立连接的 Socket, 并初始化监听他们的 end、close 事件 */
    getInitedStateConnectedCpc() {
        const { cpcClient, cpcServer, onErr } = this.createConnectedFcp();

        const c = {
            onEnd: vi.fn(),
            onClose: vi.fn(),
            cpc: cpcClient,
        };
        const s = {
            onEnd: vi.fn(),
            onClose: vi.fn(),
            cpc: cpcServer,
        };
        cpcClient.on("end", c.onEnd);
        cpcClient.on("close", c.onClose);
        cpcServer.on("end", s.onEnd);
        cpcServer.on("close", s.onClose);
        return { s, c, onErr };
    }
}

export function nextMacaoTask(time?: number) {
    return new Promise((resolve) => setTimeout(resolve, time));
}
