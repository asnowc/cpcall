const cpcall = await import("https://esm.sh/cpcall@0.6.7");
async function connectWsCpc() {
  const ws = new WebSocket("ws://127.0.0.1:8887");
  const cpc = await cpcall.createWebSocketCpcOnOpen(ws);
  cpc.exposeObject(globalThis);
  const remote = cpc.genCaller();
  await remote.console.log("Alice called Bob");

  await cpc.endCall();
}

connectWsCpc();
