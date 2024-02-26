import { createServer } from "node:net";
import { createSocketCpc } from "cpcall/node";
import { ServerService } from "./service_server.js";
import type { ClientService } from "./service_client.js"; //仅导入类型

const server = createServer(async (socket) => {
  const serverCpc = createSocketCpc(socket);
  serverCpc.setObject(new ServerService());
  await using caller = serverCpc.genCaller<ClientService>(); //配置类型，获取客户端完整的类型提示

  const msg = await caller.getData(8);  // 调用客户端函数
  console.log("server", msg);

});
server.listen(8888);
