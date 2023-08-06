import { Cpc } from "#rt/cpc/cpc.js";
import { CpcCmdList, CpcUnknownFrameTypeError, FrameType } from "#rt/cpc/cpc_frame.type.js";

export abstract class FrameCpc<
    CallableCmd extends CpcCmdList = CpcCmdList,
    CmdList extends CpcCmdList = CpcCmdList
> extends Cpc<CallableCmd, CmdList> {
    protected sendAsyncRes(id: number, arg?: any, error?: boolean | undefined): void {
        const frame: F_asyncRes = [error ? FrameType.reject : FrameType.resolve, id, arg];
        this.sendFrame(frame);
    }
    protected sendCall(command: string | number, args: any[] = [], ignoreReturn?: boolean): void {
        let type: F_call["0"];
        if (typeof command === "number") type = ignoreReturn ? FrameType.ignoreReturnExec : FrameType.exec;
        else type = ignoreReturn ? FrameType.ignoreReturnCall : FrameType.call;
        const frame: F_call = [type, command, args];
        this.sendFrame(frame);
    }
    protected sendEnd(): void {
        const frame: F_end = [FrameType.fin];
        this.sendFrame(frame);
    }
    protected sendReturn(value: any, error?: boolean, isNoExist?: boolean): void {
        if (error) {
            const frame: F_throw = [FrameType.throw, value, isNoExist];
            this.sendFrame(frame);
        } else {
            let frame: F_return = [FrameType.return, value];
            this.sendFrame(frame);
        }
    }
    protected sendReturnAsync(id: any): void {
        let frame: F_returnAsync = [FrameType.returnAsync, id];
        this.sendFrame(frame);
    }
    protected abstract sendFrame(frame: CpcFrame): void;
    protected onCpcFrame(frame: CpcFrame) {
        switch (frame[0]) {
            case FrameType.call:
                this.onCpcCall(frame[1], frame[2]);
                break;
            case FrameType.exec:
                this.onCpcCall(frame[1], frame[2]);
                break;
            case FrameType.ignoreReturnCall:
                this.onCpcCall(frame[1], frame[2], true);
                break;
            case FrameType.ignoreReturnExec:
                this.onCpcCall(frame[1], frame[2], true);
                break;

            case FrameType.return:
                this.onCpcReturn(frame[1]);
                break;
            case FrameType.throw:
                this.onCpcReturn(frame[1], true, frame[2]);
                break;
            case FrameType.returnAsync:
                this.onCpcReturnAsync(frame[1]);
                break;
            case FrameType.resolve:
                this.onCpcAsyncRes(frame[1], frame[2]);
                break;
            case FrameType.reject:
                this.onCpcAsyncRes(frame[1], frame[2], true);
                break;

            case FrameType.fin:
                this.onCpcEnd();
                break;
            default:
                this.onCpcError(new CpcUnknownFrameTypeError((frame as any)?.type));
                break;
        }
    }
}
type F_call = [
    type: FrameType.call | FrameType.exec | FrameType.ignoreReturnCall | FrameType.ignoreReturnExec,
    cmd: string | number,
    args: any[]
];
type F_return = [type: FrameType.return, value: any];
type F_throw = [type: FrameType.throw, value: any, noExist?: boolean];
type F_returnAsync = [type: FrameType.returnAsync, id: number];
type F_asyncRes = [type: FrameType.reject | FrameType.resolve, id: number, value: any];
type F_end = [type: FrameType.fin];
export type CpcFrame = F_call | F_asyncRes | F_returnAsync | F_end | F_return | F_throw;
