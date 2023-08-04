import { TcpNetConnectOpts, createConnection, Server, ServerOpts } from "node:net";
import { EventEmitter } from "node:events";
import { createReaderFromReadable } from "./common/stream_util.js";
import { CpcCmdList } from "./cpc.js";
import { Duplex } from "node:stream";
import { StreamCpc } from "./cpcp/stream_cpc.js";

/**
 * 事件触发顺序：end->close
 * end 触发后如果在调 call() 则会抛出异常
 *
 * `Fcp`依赖一个`Duplex`.
 * 如果 `duplex.writableEnded` || `duplex.readableEnded` || `duplex.destroyed` 为真，则 `Fcp`默认就是`closed`状态.
 * `duplex` 的`end`和`close`事件会触发 Fcp 的`close`
 *
 */
export class CpcSocket<
    CallableCmd extends CpcCmdList = CpcCmdList,
    CmdList extends CpcCmdList = CpcCmdList,
    Dp extends Duplex = Duplex
> extends StreamCpc<CallableCmd, CmdList> {
    #duplex: Dp;
    get duplex() {
        return this.#duplex;
    }

    constructor(duplex: Dp) {
        super({
            read: createReaderFromReadable(duplex),
            write: (buf: ArrayBufferView) => {
                duplex.write(buf);
            },
            handshake: true,
        });
        this.#duplex = duplex;
        if (duplex.destroyed || duplex.writableEnded || duplex.readableEnded) {
            this.finalEnd();
        }
        duplex.on("finish", () => this.end());
    }

    /** 最后的Fcp对象清理操作 */
    protected finalClose() {
        if (!this.#duplex.writableEnded) this.#duplex.end(() => this.#duplex.destroy());
        else this.#duplex.destroy();
        return super.finalClose();
    }
}

//todo:
class CpcpServer extends EventEmitter {
    readonly server: Server;
    constructor(options?: ServerOpts) {
        super();
        this.server = new Server(options);
        this.server.on("close", () => {
            this.emit("close");
        });
        this.server.on("connection", (socket) => {
            this.emit("connection", new CpcSocket(socket));
        });
        this.server.on("drop", () => {});
        this.server.on("error", (err) => {
            this.emit("error", err);
        });
        this.server.on("listening", () => {});
    }
}
interface CpcpServer {
    on(eventName: "error", fx: (err: any) => void): this;
    on(eventName: "error", fx: (err: any) => void): this;
    on(eventName: "connection", fx: (fcpSocket: CpcSocket) => void): this;
    on(eventName: "error", fx: (err: any) => void): this;
    on(eventName: string | symbol, listener: (...args: any[]) => void): this;
}

export interface CpcpConnectOption extends TcpNetConnectOpts {}
export async function createCpcpConnection(option: TcpNetConnectOpts) {
    option = Object.assign({}, option);
    const socket = createConnection(option);
    return new Promise((resolve, reject) => {
        socket.on("connect", () => {
            socket.removeAllListeners("error");
            socket.removeAllListeners("close");
            resolve(new CpcSocket(socket));
        });
        socket.on("error", reject);
        socket.on("close", reject);
    });
}
