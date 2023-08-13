import { CpcFrame, Cpc, CpcCmdList } from "./cpc.js";
import { sendCpcFrame, readCpcFrame } from "./cpc/transition_frame.js";

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
        socket.onerror = (e) => this.emit("error", e);
        socket.onclose = (e) => this.dispose();
    }
    private onMsg = (event: MessageEvent<ArrayBuffer>) => {
        const buf = event.data;
        if (buf instanceof ArrayBuffer) {
            const frame = readCpcFrame(Buffer.from(buf));
            this.onCpcFrame(frame);
        }
    };
    protected sendFrame(frame: CpcFrame): void {
        const chunks = sendCpcFrame(frame)[0];
        this.socket.send(Buffer.concat(chunks));
    }
}
