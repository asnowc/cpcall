import { FrameCpc, CpcFrame } from "./cpcp/frame_cpc.js";
import { EventEmitter } from "events";
import { JBSON, toArrayJBSON } from "#rt/common/js_bson.js";
import { CpcCmdList } from "./cpc/cpc_frame.type.js";
interface NodeProcess extends EventEmitter {
    send?: typeof process.send;
}
/** 进程通信Cpc */
export class NodeProcessCpc<
    CallList extends CpcCmdList = CpcCmdList,
    CmdList extends CpcCmdList = CpcCmdList
> extends FrameCpc {
    constructor(private process: NodeProcess, private noAdv?: boolean) {
        super();
        if (typeof process.send !== "function") throw new Error();
        this.send = process.send;
        this.initEvent();
    }
    private send: (msg?: any) => void;

    private initEvent() {
        this.process.on("message", this.onData);
        this.process.on("exit", () => {
            this.dispose();
        });
    }
    protected finalClose() {
        this.process.off("message", this.onData);
        return super.finalClose();
    }

    private onData = (data: string | Buffer) => {
        const bufData: Buffer = this.noAdv ? Buffer.from(data as string, "ascii") : (data as Buffer);
        const frame: CpcFrame = JBSON.toArray(bufData);
        this.onCpcFrame(frame);
    };

    protected sendFrame(frame: CpcFrame): void {
        let buffer: string | Buffer = toArrayJBSON(frame);
        if (this.noAdv) buffer = buffer.toString("ascii");
        this.send(buffer);
    }

    private static current?: NodeProcessCpc;
    static getCurrent() {
        let current = this.current;
        if (!current) {
            current = new this(process);
            this.current = current;
        }
        return current;
    }
}
