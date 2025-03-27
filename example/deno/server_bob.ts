import { CpCall, createWebSocketCpcOnOpen, createWebStreamCpc } from "cpcall";

async function onRpcConnected(cpc: CpCall) {
  cpc.exposeObject(globalThis);
  const remoteAlice = cpc.genCaller();
  await remoteAlice.console.log("Bob called Alice");
  await cpc.endCall();
}

// TPC 服务
async function startTpcServe() {
  const server = Deno.listen({ port: 8888 });
  for await (const conn of server) {
    const cpc = createWebStreamCpc(conn);
    onRpcConnected(cpc);
  }
}
function startHttpServe() {
  Deno.serve({ port: 8887 }, function (req, res): Response {
    const upgrade = req.headers.get("upgrade") || "";
    if (upgrade.toLowerCase() != "websocket") {
      return new Response("hi");
    }
    const { response, socket } = Deno.upgradeWebSocket(req);
    createWebSocketCpcOnOpen(socket).then(onRpcConnected).catch(console.error);
    return response;
  });
}

startTpcServe();
startHttpServe();
