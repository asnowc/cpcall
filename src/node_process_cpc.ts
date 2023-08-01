import { Cpc } from "./cpc.js";
import { CpcUnknownFrameTypeError, FrameType } from "./cpc_frame.type.js";
import { EventEmitter } from "events";
interface NodeProcess extends EventEmitter {
    send?: typeof process.send;
}
/** 进程通信Cpc */
export class NodeProcessCpc extends Cpc {
    constructor(private process: NodeProcess) {
        super();
        this.send = typeof process.send === "function" ? process.send : this.noSend;
        this.initEvent();
    }
    send: (msg?: any) => void;
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

    private onData = (data: Frame) => {
        switch (data.type) {
            case FrameType.call:
                this.onCpcCall(data.cmd, data.args ?? []);
                break;
            case FrameType.return:
                this.onCpcReturn(data.value);
                break;
            case FrameType.throw:
                this.onCpcReturn(data.value, true, data.noExist);
                break;
            case FrameType.returnAsync:
                this.onCpcReturnAsync(data.id);
                break;
            case FrameType.resolve:
                this.onCpcAsyncRes(data.id, data.value);
                break;
            case FrameType.reject:
                this.onCpcAsyncRes(data.id, data.value, true);
                break;
            // case FrameType.streamFrame:
            // break;

            case FrameType.fin:
                this.onCpcEnd();
                break;
            default:
                this.onCpcError(new CpcUnknownFrameTypeError((data as any)?.type));
                break;
        }
    };
    protected sendAsyncRes(id: number, value?: any, error?: boolean | undefined): void {
        let frameType = error ? FrameType.reject : FrameType.resolve;
        let frame: F_asyncRes = { type: frameType, id, value };
        this.send(frame);
    }
    protected sendCall(command: string | number, args?: any[]): void {
        let frame: F_call = { type: FrameType.call, cmd: command, args };
        this.send(frame);
    }
    protected sendEnd(): void {
        let frame: F_end = { type: FrameType.fin };
        this.send(frame);
    }
    protected sendReturn(value: any, error?: boolean | undefined, noExist?: boolean | undefined): void {
        if (error) {
            const frame: F_throw = { type: FrameType.throw, value, noExist };
            this.send(frame);
        } else {
            let frame: F_return = { type: FrameType.return, value };
            this.send(frame);
        }
    }
    protected sendReturnAsync(id: any): void {
        let frame: F_returnAsync = { type: FrameType.returnAsync, id };
        this.send(frame);
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

interface F_call {
    type: FrameType.call;
    cmd: string | number;
    args?: any[];
}
interface F_return {
    type: FrameType.return;
    value: any;
}
interface F_throw {
    type: FrameType.throw;
    value: any;
    noExist?: boolean;
}
interface F_returnAsync {
    type: FrameType.returnAsync;
    id: number;
}
interface F_asyncRes {
    type: FrameType.reject | FrameType.resolve;
    id: number;
    value: any;
}

interface F_streamFrame {
    type: FrameType.streamFrame;
    data: Buffer;
}
interface F_end {
    type: FrameType.fin;
}
type Frame = F_call | F_asyncRes | F_returnAsync | F_end | F_return | F_throw | F_streamFrame;
