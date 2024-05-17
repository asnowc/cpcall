import { CpCall, trans, RpcFrame, RpcFrameCtrl } from "cpcall";
import { PassiveDataCollector } from "evlib/async";

function webSocketToIter(webSocket: WebSocket) {
  const collector = new PassiveDataCollector<RpcFrame, Error | void>();
  webSocket.addEventListener("message", (e) => {
    if (e.data instanceof ArrayBuffer) {
      const framesIterator = trans.unpackCpcFrames(new Uint8Array(e.data), 0);
      for (const frame of framesIterator) collector.yield(frame);
    }
  });
  webSocket.addEventListener("close", (e) => {
    collector.close();
  });
  webSocket.addEventListener("error", (e) => {
    collector.close(new Error("Websocket encountered an error", { cause: (e as any).data }));
  });
  return collector.getAsyncGen();
}

/** 创建一个基于 WebSocket 的 CpCall 实例。WebSocket 的状态必须是 open。 否则抛出异常
 * @public
 */
export function createWebSocketCpc(websocket: WebSocket) {
  if (websocket.readyState !== websocket.OPEN) throw new Error("Wrong websocket status");
  return new CpCall(new WsRpcFrameCtrl(websocket));
}
class WsRpcFrameCtrl implements RpcFrameCtrl {
  constructor(private ws: WebSocket) {
    ws.binaryType = "arraybuffer";
    this.frameIter = webSocketToIter(ws);
  }
  frameIter: AsyncIterable<RpcFrame>;
  private link: RpcFrame[] = [];
  send() {
    //todo: 需要改进，当源关闭后直接将 callee 和 caller 关闭
    if (this.ws.readyState === this.ws.OPEN) {
      const chunk = trans.packCpcFrames(this.link);
      this.ws.send(chunk);
      this.link.length = 0;
    } else {
      this.dispose();
    }
  }
  sendFrame(frame: RpcFrame): void {
    if (this.link.length === 0) Promise.resolve().then(() => this.send());
    this.link.push(frame);
  }
  close() {
    this.ws.close();
  }
  dispose(): void {
    this.ws.close();
  }
}
// WebSocket 最小依赖。
interface WebSocket {
  readonly OPEN: number;
  readonly readyState: number;
  binaryType: string;
  close(): void;
  send(data: Uint8Array): void;
  addEventListener(name: "message", fn: (e: { readonly data: any }) => void): void;
  addEventListener(name: string, fn: (e: SameEvent) => void): void;
  addEventListener(name: string, fn: (e: SameEvent) => void): void;
}
interface SameEvent {
  [key: string]: any;
}
