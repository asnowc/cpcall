import { CpcCmdList, Cpc, CpcEvents, CpcFrame } from "./cpc.js";
import { readCpcFrame, sendCpcFrame } from "../cpc/transition_frame.js";
import { DLD, numToDLD } from "#lib/js_bson.js";

type StreamWriter = (chunk: Uint8Array) => void;
/**
 * @public
 */
export interface StreamReader {
    (len: number, safe?: false): Promise<Uint8Array>;
    (len: number, safe: true): Promise<Uint8Array | null>;
    (len: number, safe?: boolean): Promise<Uint8Array | null>;
}
/**
 * @public
 */
export interface CpcStreamCtrl {
    read: StreamReader;
    write: StreamWriter;
    isWriteable?: () => boolean;
    handshake?: number;
}
/**
 * @public
 */
export class StreamCpc<
    CallableCmd extends object = CpcCmdList,
    CmdList extends object = CpcCmdList,
    Ev extends CpcEvents = CpcEvents
> extends Cpc<CallableCmd, CmdList, Ev> {
    #read: StreamReader;
    #write: StreamWriter;
    #isWriteable: () => boolean;
    constructor(streamCtrl: CpcStreamCtrl) {
        super(2 ** 32 - 1);
        this.#read = streamCtrl.read;
        this.#write = streamCtrl.write;
        this.#isWriteable = streamCtrl.isWriteable ?? (() => false);
        this.#start(streamCtrl.handshake).catch((error) => this.dispose(error));
    }
    async #start(handshake?: number) {
        if (handshake && handshake > 0) {
            this.#write(new Uint8Array(handshake)); //HAND_SHAKE_LEN 个字节的 0, 握手机制, 确认连接
            if (!(await this.initCheck(handshake))) return;
        }
        return this.readFrame();
    }
    private async initCheck(handshake: number) {
        const read = this.#read;
        for (let i = 0; i < handshake; i++) {
            let buf = await read(1);
            if (buf[0] !== 0) {
                this.onCpcError(new Error("初始化失败"));
                this.dispose();
                return false;
            }
        }
        return true;
    }
    private async readFrame() {
        const read = this.#read;
        while (true) {
            const frameLen = await DLD.readNumber(read, true);
            if (frameLen === undefined) break; // 流已结束或关闭

            const frameBuf = await read(frameLen);
            const frame = readCpcFrame(frameBuf);
            this.onCpcFrame(frame);
        }
        if (!this.isEnded) this.finalEnd(); //对方未发送 fin 帧
        if (!this.closed) {
            //waitingResultNum可能不为0 (存在等待对方返回结果的Promise)，但是此时流已经 end
            if (this.waitingResponseNum === 0) this.dispose(); //无等待响应
            else if (!this.#isWriteable()) this.dispose(); //有等待响应并且流已经不可写
        }
    }

    protected sendFrame(frame: CpcFrame) {
        const [chunks, totalLen] = sendCpcFrame(frame);
        try {
            this.#write(numToDLD(totalLen));
            for (let i = 0; i < chunks.length; i++) {
                this.#write(chunks[i]);
            }
        } catch (error) {
            this.dispose(new Error("Unable to write data", { cause: error }));
        }
    }
}
