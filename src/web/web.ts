import { CpcFrame, Cpc, CpcCmdList } from "../cpc/cpc.js";
import { sendCpcFrame, readCpcFrame, concatUint8ArrayList } from "../cpc/cpc/transition_frame.js";

/**
 * @beta
 */
export class WebSocketCpc<CallableCmd extends object = CpcCmdList, CmdList extends object = CpcCmdList> extends Cpc<
    CallableCmd,
    CmdList
> {
    static createConnect(url: string | URL, protocols?: string | string[]) {
        return new Promise<WebSocketCpc>(function (resolve, reject) {
            const socket = new WebSocket(url, protocols);
            socket.binaryType = "arraybuffer";
            socket.onerror = reject;
            socket.onopen = () => resolve(new WebSocketCpc(socket));
        });
    }
    private constructor(private socket: WebSocket) {
        super();
        socket.onmessage = this.onMsg;
        socket.onerror = (e) => this.$error.emit(new Error("websocket error", { cause: Event }));
        socket.onclose = (e) => this.dispose();
    }
    private onMsg = (event: MessageEvent<ArrayBuffer>) => {
        const buf = event.data;
        if (buf instanceof ArrayBuffer) {
            const frame = readCpcFrame(new Uint8Array(buf));
            this.onCpcFrame(frame);
        }
    };
    protected sendFrame(frame: CpcFrame): void {
        const [chunks, size] = sendCpcFrame(frame);
        const buf = concatUint8ArrayList(chunks, size);
        this.socket.send(buf);
    }
}
