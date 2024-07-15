import { createWebStreamCpc } from "cpcall";

async function connTcpCpc() {
  const conn = await Deno.connect({ port: 8888 });
  const cpc = createWebStreamCpc(conn);
  cpc.exposeObject(globalThis);

  const remote = cpc.genCaller<typeof globalThis>();
  await remote.console.log("ha ha");

  await cpc.close();
}

await connTcpCpc();
