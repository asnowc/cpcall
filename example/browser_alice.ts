import { createWebSocketCpcOnOpen } from "https://esm.sh/cpcall";

async function connectWsCpc() {
  const ws = new WebSocket("ws://127.0.0.1:8887");
  const cpc = await createWebSocketCpcOnOpen(ws);
  cpc.exposeObject(globalThis);
  const remote = cpc.genCaller<typeof globalThis>();
  await remote.console.log("Alice called Bob");

  await cpc.close();
}

connectWsCpc();
