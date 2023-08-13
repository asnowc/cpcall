import type { EventEmitter } from "events";
import { CpcCmdList, Cpc, CpcFrame } from "../cpc.js";
import { readCpcFrame, sendCpcFrame } from "../cpc/transition_frame.js";
interface NodeProcess extends EventEmitter {
    send?: typeof process.send;
}
/** 进程通信Cpc */
class NodeProcessCpc<CallList extends CpcCmdList = CpcCmdList, CmdList extends CpcCmdList = CpcCmdList> extends Cpc {
    /**
     * @param noAdvSerialization NodeProcessCpc 使用二进制传送数据.
     * 如果node进程不支持传送ArrayBuffer, 则可以设置 noAdvSerialization为 true, 这会将Arraybuffer 使用 ascii 编码转为字符串后传输
     */
    constructor(private process: NodeProcess, private noAdvSerialization?: boolean) {
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
        const bufData: Buffer = this.noAdvSerialization ? Buffer.from(data as string, "ascii") : (data as Buffer);
        const frame: CpcFrame = readCpcFrame(bufData);
        this.onCpcFrame(frame);
    };

    protected sendFrame(frame: CpcFrame): void {
        const chunks = sendCpcFrame(frame)[0];
        let buffer: Buffer | string = Buffer.concat(chunks);
        if (this.noAdvSerialization) buffer = buffer.toString("ascii");
        this.send(buffer);
    }
}

/**
 * @param noAdvSerialization NodeProcessCpc 使用二进制传送数据.
 * 如果node进程不支持传送ArrayBuffer, 则可以设置 noAdvSerialization为 true, 这会将Arraybuffer 使用 ascii 编码转为字符串后传输
 */
export function createNodePsCpc<CallableCmd extends object = CpcCmdList, CmdList extends object = CpcCmdList>(
    process: NodeProcess,
    noAdvSerialization?: boolean
): Cpc<CallableCmd, CmdList> {
    return new NodeProcessCpc(process, noAdvSerialization);
}
