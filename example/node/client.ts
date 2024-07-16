import { connect, Socket } from "node:net";
import { createSocketCpc } from "cpcall";

const socket = connect(8888);
socket.on("connect", async () => {
  const cpc = createSocketCpc(socket);
  const remote = cpc.genCaller<typeof globalThis>();

  await remote.console.log("Hello, I am Client");

  await cpc.close();
});
