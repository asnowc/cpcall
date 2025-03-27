import { createWebStreamCpc } from "cpcall";

async function connTcpCpc() {
  const conn = await Deno.connect({ port: 8888 });
  const cpc = createWebStreamCpc(conn);
  cpc.exposeObject(globalThis);

  const remoteBob = cpc.genCaller<typeof globalThis>();
  await remoteBob.console.log("Alice called bob");

  await cpc.endCall();
}

await connTcpCpc();
