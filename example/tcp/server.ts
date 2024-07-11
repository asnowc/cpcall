import { Socket, createServer } from "node:net";
import { createSocketCpc } from "cpcall/node";

// 这是暴露给客户端调用的类
class ServerApi {
  add(a: number, b: number) {
    const res = a + b;
    console.log(`${a} + ${b} = ${res}`);
    return res;
  }
}

const server = createServer(onConnect);
server.listen(8888, "127.0.0.1");
console.log("listen 127.0.0.1:8888");

// 当客户端连接时的回调函数
function onConnect(socket: Socket) {
  const cpc = createSocketCpc(socket, {
    disableCall: true, //关闭了调用端。如果需要发起调用，则应忽略或设置为 false
    serveObject: new ServerApi(), //暴露接口
  });
  cpc.onClose.finally(() => console.log("cpc closed")); //连接关闭事件
}

export type { ServerApi }; //导出类型，以便客户端获得完整类型提示
