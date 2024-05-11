import { Socket, createServer } from "node:net";
import { createSocketCpc } from "cpcall/node";

const server = createServer(onConnect);
server.listen(8888);

// 当客户端连接时的回调函数
function onConnect(socket: Socket) {
  const cpc = createSocketCpc(socket);
  cpc.caller.end(); //不需要调用客户端，为了保证后续正常断开连接，需要手动调用 caller.end() 方法
  cpc.closeEvent.then(() => console.log("cpc closed")); //连接关闭事件
  cpc.setObject(new ServerApi()); //暴露接口
}

// 这是暴露给客户端调用的类
class ServerApi {
  add(a: number, b: number) {
    const res = a + b;
    console.log(`${a} + ${b} = ${res}`);
    return res;
  }
}

export type { ServerApi }; //导出类型，以便客户端获得完整类型提示
