import { createReaderFromReadable } from "./common/node_stream_util.js";
import { Duplex } from "node:stream";
import { StreamCpc } from "./cpcp/stream_cpc.js";
import { CpcCmdList } from "./cpc/cpc.js";

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
            handshake: 5,
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
