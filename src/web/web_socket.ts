/// <reference lib="dom"/>

import { CpCall, trans, RpcFrame, RpcFrameCtrl } from "cpcall";
import { PassiveDataCollector } from "evlib/async";

function webSocketToIter(webSocket: WebSocket) {
  const collector = new PassiveDataCollector<RpcFrame, Error | void>();
  webSocket.addEventListener("message", (e) => {
    if (e.data instanceof ArrayBuffer) {
      collector.yield(trans.decodeCpcFrame(new Uint8Array(e.data)).frame);
    }
  });
  webSocket.addEventListener("close", () => {
    collector.close();
  });
  webSocket.addEventListener("error", (e) => {
    collector.close(new Error("unknown error"));
  });
  return collector.getAsyncGen();
}
/** @public */
export function createWebSocketCpc(url: string): CpCall;
export function createWebSocketCpc(websocket: WebSocket): CpCall;
export function createWebSocketCpc(websocket: WebSocket | string) {
  if (typeof websocket === "string") websocket = new WebSocket(websocket);
  return new CpCall(new WsRpcFrameCtrl(websocket));
}
class WsRpcFrameCtrl implements RpcFrameCtrl {
  constructor(private ws: WebSocket) {
    ws.binaryType = "arraybuffer";
    this.frameIter = webSocketToIter(ws);
  }
  frameIter: AsyncIterable<RpcFrame>;
  sendFrame(frame: RpcFrame): void {
    //todo: 需要改进，当源关闭后直接将 callee 和 caller 只为
    if (this.ws.readyState == this.ws.OPEN) this.ws.send(new trans.CpcFrameEncoder(frame).encode());
  }
  dispose(): void | Promise<void> {
    this.ws.close();
  }
}
