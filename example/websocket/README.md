这是一个基于 WebSocket 的示例。
服务端运行在 Deno
客户端运行在浏览器

### 示例运行步骤

1. 运行服务端代码 [server.ts](./server.ts): 执行命令 `deno run --allow-net server.ts`，将启动一个 Web 服务
2. 在浏览器输入 http://localhost:8888, 访问服务器
3. 打开控制台，将以下代码 (文件 [client.ts](./client.ts) 编译后的代码) 粘贴到控制台执行

```ts
/// <reference lib="dom"/>
function connectWs(url) {
  return new Promise(function (resolve, reject) {
    const ws = new WebSocket(url);
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject();
  });
}
const { createWebSocketCpc } = await import("https://esm.sh/cpcall@0.4.x/web");
// 与服务端创建基于 WebSocket 的 RPC 连接
async function connect() {
  const ws = await connectWs("ws://localhost:8888");
  const cpc = createWebSocketCpc(ws);
  cpc.setObject(new ClientApi()); // 暴露接口给服务端
  return cpc;
}
let cpc = await connect();
let serverApi = cpc.genCaller();
class SubApi {
  // 更改 web 页面的背景颜色
  changeBgColor(color) {
    document.body.style.backgroundColor = color;
  }
}
// 暴露给服务端的类
class ClientApi {
  // 子类对象示例。
  sub = new SubApi();
  log(data) {
    console.log(data);
  }
}
```

4. 可以看到页面背景不断闪烁变化，这部分逻辑是在服务端控制的。
5. 在控制台执行代码 `await serverApi.log(111)`， 测试服务端远程对象方法效果，你可以看到在一秒后输出一个随机数
