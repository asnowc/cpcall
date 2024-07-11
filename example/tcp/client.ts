import { createSocketCpc } from "cpcall";
import { Socket, connect } from "node:net";
import type { ServerApi } from "./server.ts"; //导入服务端暴露 api 的类型

const socket = await connectSocket(8888, "localhost"); //创建 TCP 连接

const cpc = createSocketCpc(socket, {
  disableServe: true, // 关闭了调用服务。如果需要暴露对象，则应忽略或设置为 false
}); //创建 cpc 实例
const serverApi = cpc.genCaller<ServerApi>(); //生成远程代理对象。传入类型，可获得完整类型提示

// 每秒调用一次远程方法 add, 并输出结果。 调用5次后结束
for (let i = 0; i < 5; i++) {
  const res = await serverApi.add(i, 5);
  console.log(res);
  await delay(1000);
}

function delay(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

async function connectSocket(port: number, host?: string): Promise<Socket> {
  return new Promise(function (resolve) {
    const socket = connect({ port, host });
    socket.once("connect", () => resolve(socket));
  });
}
