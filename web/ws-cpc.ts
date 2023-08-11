import { CpcFrame, FrameCpc, CpcCmdList, JBSON, toArrayJBSON } from "./cpc.js";

export class WebSocketCpc<
    CallableCmd extends object = CpcCmdList,
    CmdList extends object = CpcCmdList
> extends FrameCpc<CallableCmd, CmdList> {
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
            let offset = 0;
            let frame = JBSON.toArray<CpcFrame>(buf, offset);
            this.onCpcFrame(frame);
        }
    };
    protected sendFrame(frame: CpcFrame): void {
        this.socket.send(toArrayJBSON(frame));
    }
}
