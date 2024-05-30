/// <reference lib="dom"/>
function connectWs(url: string) {
  return new Promise<WebSocket>(function (resolve, reject) {
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

class SubApi {
  // 更改 web 页面的背景颜色
  changeBgColor(color: string) {
    document.body.style.backgroundColor = color;
  }
}
// 暴露给服务端的类
class ClientApi {
  // 子类对象示例。
  sub = new SubApi();
  log(data: any) {
    console.log(data);
  }
}

let cpc = await connect();
let serverApi = cpc.genCaller();
export type { ClientApi };
