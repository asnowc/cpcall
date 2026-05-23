import { connect, Socket } from "node:net";
import { createSocketCpc } from "cpcall";

const socket = connect(8888);
socket.on("connect", async () => {
  const cpc = createSocketCpc(socket);

  await cpc.call("console.log", "Alice Called Bob");

  await cpc.endCall();
});
