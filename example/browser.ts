import { createWebSocketCpcOnOpen } from "https://esm.sh/cpcall@0.6.0";

async function connectWsCpc() {
  const ws = new WebSocket("ws://127.0.0.1:8887");
  const cpc = await createWebSocketCpcOnOpen(ws);
  cpc.exposeObject(globalThis);
  const remote = cpc.genCaller<typeof globalThis>();
  await remote.console.log("ha ha");

  await cpc.close();
}

connectWsCpc();
