import { FrameCpc, CpcFrame } from "./cpcp/frame_cpc.js";
import { EventEmitter } from "events";
import { Trans } from "./cpcp/json_frame_transformer.js";
interface NodeProcess extends EventEmitter {
    send?: typeof process.send;
}
/** 进程通信Cpc */
export class NodeProcessCpc extends FrameCpc {
    constructor(private process: NodeProcess) {
        super();
        this.send = typeof process.send === "function" ? process.send : this.noSend;
        this.initEvent();
    }
    private send: (msg?: any) => void;
    private trans = new Trans();
    private noSend() {
        this.onCpcReturn(new Error("No parent process"), true);
        return false;
    }
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

    private onData = (data: CpcFrame) => {
        const frame = this.trans.readValue(data);
        this.onCpcFrame(frame);
    };

    sendFrame(frame: CpcFrame): void {
        this.send(this.trans.writeValue(frame));
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
