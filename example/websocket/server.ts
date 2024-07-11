import { createWebsocketCpcOnOpen } from "cpcall/web";

interface ClientApi {
  changeBgColor(color: string): void;
  console: Console;
}

//http 服务
Deno.serve({ port: 8888 }, function (req, res): Response {
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() != "websocket") {
    const jsFile = Deno.readTextFile(import.meta.dirname! + "/client.js");
    return new Response(`
<script type="module">${jsFile}</script>
<body>hi</body>
`);
  }

  //协议升级为 WebSocket
  const { response, socket } = Deno.upgradeWebSocket(req);
  onWebSocketConnect(socket).catch(console.error);
  return response;
});

// 客户端 WebSocket 连接的回调函数
async function onWebSocketConnect(ws: WebSocket) {
  const cpc = await createWebsocketCpcOnOpen(ws, {
    serveObject: new ServerAPi(), //设置暴露给客户端的接口
  }); // 创建 cpc 实例
  cpc.onClose.finally(() => console.log("cpc closed")); // rpc 断开连接事件
  const clientAPi = cpc.genCaller<ClientApi>(); //生成远程代理对象

  // 调用客户端暴露的接口。 这里是每秒更改一次 web 页面背景颜色。一共30 次
  for (let i = 0; i < 30; i++) {
    await clientAPi.changeBgColor(i % 2 === 0 ? "#ac0" : "#299");
    await delay(1000);
  }

  await cpc.endCall();
}

// 暴露给客户端的类
class ServerAPi {
  // 模拟异步方法。 输出数据到服务器的控制台，一秒钟后返回一个随机数
  async log(data: any) {
    console.log(data);
    await delay(1000);
    return Math.random();
  }
  // 一个会抛出异常的方法
  deleteFile(): never {
    throw new Error("无法删除文件");
  }
}
function delay(time: number) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
