import { createServer } from "node:net";
import { createSocketCpc } from "cpcall/node";
import { ServerService } from "./service_server.js";
import type { ClientService } from "./service_client.js"; //仅导入类型

const server = createServer(async (socket) => {
  console.log("server", "connected");

  socket.on("close", () => console.log("server close"));
  const serverCpc = createSocketCpc(socket);
  serverCpc.setObject(new ServerService());
  const caller = serverCpc.genCaller<ClientService>(); //配置类型，获取客户端完整的类型提示

  const msg = await caller.getData(8);
  console.log("server", msg);

  serverCpc.caller.end(); //结束调用
  await serverCpc.$close();
  server.close();
});
server.listen(8888);
