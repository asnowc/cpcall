import { createWebSocketCpcOnOpen, createWebStreamCpc } from "cpcall";

// TPC 服务
async function tcpServer() {
  const server = Deno.listen({ port: 8888 });
  for await (const conn of server) {
    const cpc = createWebStreamCpc(conn);
    cpc.exposeObject(globalThis);
    cpc.onClose.catch(console.error);
    const remote = cpc.genCaller();
    remote.console.log("Hi, I am Server");
  }
}
function httpServer() {
  Deno.serve({ port: 8887 }, function (req, res): Response {
    const upgrade = req.headers.get("upgrade") || "";
    if (upgrade.toLowerCase() != "websocket") {
      return new Response("hi");
    }
    const { response, socket } = Deno.upgradeWebSocket(req);
    createWebSocketCpcOnOpen(socket).then((cpc): void => {
      cpc.exposeObject(globalThis);
      cpc.onClose.catch(console.error);
      const remote = cpc.genCaller();
      remote.console.log("Hi, I am Server");
    }, console.error);
    return response;
  });
}

tcpServer();
httpServer();
