import { Cpc, CpcCmdList } from "../cpc.js";
import {
    callRead,
    asyncResultRead,
    returnRead,
    throwRead,
    returnAsyncRead,
    throwWrite,
    returnWrite,
    asyncResultWrite,
    callWrite,
    returnAsyncWrite,
} from "./frame_transformer.js";
import type { StreamReader, StreamWriter } from "../common/stream_util.js";
import { CpcUnknownFrameTypeError, FrameType } from "../cpc_frame.type.js";

export interface CpcStreamCtrl {
    read: StreamReader;
    write: StreamWriter;
    handshake?: boolean;
}
const HAND_SHAKE_LEN = 5;
export class StreamCpc<
    CallableCmd extends CpcCmdList = CpcCmdList,
    CmdList extends CpcCmdList = CpcCmdList
> extends Cpc<CallableCmd, CmdList> {
    #read: StreamReader;
    #write: StreamWriter;
    constructor(streamCtrl: CpcStreamCtrl) {
        super(2 ** 32 - 1);
        this.#read = streamCtrl.read;
        this.#write = streamCtrl.write;
        this.#start(streamCtrl.handshake).then(
            () => this.end(),
            (error) => this.dispose(error)
        );
    }
    async #start(handshake?: boolean) {
        if (handshake) {
            this.#write(Buffer.alloc(HAND_SHAKE_LEN)); //HAND_SHAKE_LEN 个字节的 0, 握手机制, 确认连接
            if (!(await this.initCheck())) return;
        }
        return this.readFrame();
    }
    private async initCheck() {
        const read = this.#read;
        for (let i = 0; i < HAND_SHAKE_LEN; i++) {
            let buf = await read(1);
            if (buf[0] !== 0) {
                this.onCpcError(new Error("初始化失败"));
                this.dispose();
                return false;
            }
        }
        return true;
    }
    protected async readFrame() {
        const read = this.#read;
        while (true) {
            const frameType = (await read(1, true))?.readUint8();
            if (frameType === undefined) break;

            switch (frameType) {
                case FrameType.call:
                    {
                        let res = await callRead(read);
                        this.onCpcCall(res.cmd, res.args);
                    }
                    break;
                case FrameType.ignoreReturnCall:
                    {
                        let res = await callRead(read);
                        this.onCpcCall(res.cmd, res.args, true);
                    }
                    break;
                case FrameType.return:
                    this.onCpcReturn(await returnRead(read), false);
                    break;
                case FrameType.returnAsync:
                    {
                        const id = await returnAsyncRead(read);
                        this.onCpcReturnAsync(id);
                    }
                    break;
                case FrameType.throw:
                    {
                        const res = await throwRead(read);
                        this.onCpcReturn(res.data, true, res.isNoExist);
                    }
                    break;

                case FrameType.resolve:
                    {
                        let res = await asyncResultRead(read);
                        this.onCpcAsyncRes(res.asyncId, res.data);
                    }
                    break;
                case FrameType.reject:
                    {
                        const res = await asyncResultRead(read);
                        this.onCpcAsyncRes(res.asyncId, res.data, true);
                    }
                    break;
                case FrameType.streamFrame:
                    //todo
                    break;

                case FrameType.fin:
                    this.onCpcEnd();
                    break;
                default:
                    throw new CpcUnknownFrameTypeError(frameType); //致命错误。在流中未知类型会引起致命错误，因为无法知道这个帧的 content 的长度
            }
        }
    }

    protected sendCall(command: string | number, args?: any[] | undefined, ignoreReturn?: boolean): void {
        if (typeof command !== "string") command = String(command);
        callWrite(this.#write, command, args, ignoreReturn);
    }
    protected sendReturn(arg: any, error?: boolean, isNoExist?: boolean): void {
        if (error) throwWrite(this.#write, arg, isNoExist);
        else returnWrite(this.#write, arg);
    }
    protected sendEnd(): void {
        const FIN = Buffer.from([FrameType.fin]);
        this.#write(FIN);
    }
    protected sendAsyncRes(id: number, arg?: any, reject?: boolean): void {
        asyncResultWrite(this.#write, id, arg, reject);
    }
    protected sendReturnAsync(id: number): void {
        returnAsyncWrite(this.#write, id);
    }
    protected get closeable(): boolean {
        return super.closeable;
    }
}
