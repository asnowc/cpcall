// @ts-types="npm:@types/ws"
import { WebSocketServer } from "npm:ws";
import http from "node:http";
import net from "node:net";
import { CpCall, createSocketCpc, createWebSocketCpcOnOpen } from "cpcall";

async function onRpcConnected(cpc: CpCall) {
  cpc.exposeObject(globalThis);
  const remoteAlice = cpc.genCaller();
  remoteAlice.console.log("Bob called Alice");
  await cpc.endCall();
}

function startTcpServe() {
  const server = new net.Server((socket) => {
    const cpc = createSocketCpc(socket);
    onRpcConnected(cpc);
  });
  server.listen(8888);
}

function startWsServe() {
  const server = new http.Server();
  const wsServer = new WebSocketServer({ server });
  wsServer.on("connection", async (ws) => {
    createWebSocketCpcOnOpen(ws).then(onRpcConnected);
  });
  server.listen(8887);
}

startTcpServe();
startWsServe();
