import { connect } from "node:net";
import { createSocketCpc } from "cpcall/node";
import type { ServerService } from "./service_server.js"; //仅导入类型
import { ClientService } from "./service_client.js";

const clientSocket = connect({ port: 8888, host: "127.0.0.1" });

clientSocket.on("connect", async () => {
  console.log("client", "connected");
  const clientCpc = createSocketCpc(clientSocket);
  clientCpc.setObject(new ClientService()); //客户端设置服务，可由服务端主动调用

  const caller = clientCpc.genCaller<ServerService>(); //配置类型，获取服务端完整的类型提示
  const data1 = await caller.getData();
  console.log("client", data1);
  const data2 = await caller.sub.mul(3, 5); //15
  console.log("client", data2);

  clientCpc.caller.end(); //结束调用
  await clientCpc.$close(); //等待 socket 销毁
});
clientSocket.on("close", () => console.log("client close"));
