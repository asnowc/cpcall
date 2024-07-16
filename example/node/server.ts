// @ts-types="npm:@types/ws"
import { WebSocketServer } from "npm:ws";
import http from "node:http";
import net from "node:net";
import { createSocketCpc, createWebSocketCpcOnOpen } from "cpcall";

function tcpServer() {
  const server = new net.Server(async function (socket) {
    const cpc = createSocketCpc(socket);
    cpc.exposeObject(globalThis);
    cpc.onClose.catch(console.error);
    const remote = cpc.genCaller();
    remote.console.log("Hi, I am Server");
  });
  server.listen(8888);
}
function wsServer() {
  const server = new http.Server();
  const wsServer = new WebSocketServer({ server });
  wsServer.on("connection", async (ws) => {
    const cpc = await createWebSocketCpcOnOpen(ws);
    cpc.exposeObject(globalThis);
    cpc.onClose.catch(console.error);
    const remote = cpc.genCaller();
    remote.console.log("Hi, I am Server");
  });
  server.listen(8887);
}

tcpServer();
wsServer();
