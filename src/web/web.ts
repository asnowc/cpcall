/// <reference lib="dom"/>

import { CpCall, encodeCpcFrame, decodeCpcFrame, RpcFrame } from "cpcall";
import { PassiveDataCollector } from "evlib/async";

function webSocketToIter(webSocket: WebSocket) {
  const collector = new PassiveDataCollector<RpcFrame, Error | void>();
  webSocket.addEventListener("message", (e) => {
    if (e.data instanceof ArrayBuffer) {
      collector.yield(decodeCpcFrame(new Uint8Array(e.data)));
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
export function createWebSocketCpc(websocket: WebSocket) {
  const iter = webSocketToIter(websocket);
  return new CpCall(iter, (frame) => {
    websocket.send(encodeCpcFrame(frame));
  });
}
