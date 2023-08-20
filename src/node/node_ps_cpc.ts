import type { EventEmitter } from "events";
import { CpcCmdList, Cpc, CpcFrame } from "../cpc.js";
import { readCpcFrame, sendCpcFrame } from "../cpc/transition_frame.js";
interface NodeProcess extends EventEmitter {
    send?: typeof process.send;
}
/** 进程通信Cpc */
class NodeProcessCpc<CallList extends CpcCmdList = CpcCmdList, CmdList extends CpcCmdList = CpcCmdList> extends Cpc {
    /**
     * @remark 创建Node进程 CPC 通信
     * @param advSerialization - Node进程发送数据帧时默认将二进制转成ascii字符串后发再发送.
     * 如果Node进程通信已开启高级序列号, advSerialization 传入 true 将直接使用二进制发送数据值
     */
    constructor(private process: NodeProcess, private advSerialization?: boolean) {
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
        let bufData: Buffer;
        if (this.advSerialization) bufData = data as Buffer;
        else {
            bufData = Buffer.allocUnsafe(data.length);
            for (let i = 0; i < data.length; i++) {
                bufData[i] = (data as string).charCodeAt(i);
            }
        }
        const frame: CpcFrame = readCpcFrame(bufData);
        this.onCpcFrame(frame);
    };

    protected sendFrame(frame: CpcFrame): void {
        const [chunks, len] = sendCpcFrame(frame);
        if (this.advSerialization) {
            this.send(Buffer.concat(chunks));
        } else {
            let str = "";
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                str += String.fromCharCode(...chunk);
            }
            this.send(str);
        }
    }
}

/**
 * @public
 * @remark 创建Node进程 CPC 通信
 * @param advSerialization - Node进程发送数据帧时默认将二进制转成ascii字符串后发再发送.
 * 如果Node进程通信已开启高级序列号, advSerialization 传入 true 将直接使用二进制发送数据值
 */
export function createNodePsCpc<CallableCmd extends object = CpcCmdList, CmdList extends object = CpcCmdList>(
    process: NodeProcess,
    advSerialization?: boolean
): Cpc<CallableCmd, CmdList> {
    return new NodeProcessCpc(process, advSerialization);
}
