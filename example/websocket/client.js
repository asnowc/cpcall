//@ts-check
/// <reference lib="dom"/>

const { createWebsocketCpcOnOpen } = await import("https://esm.sh/cpcall");

// 与服务端创建基于 WebSocket 的 RPC 连接
async function connect() {
  const cpc = await createWebsocketCpcOnOpen(new WebSocket("ws://localhost:8888"));
  cpc.setObject(new ClientApi()); // 暴露接口给服务端
  return cpc;
}

// 暴露给服务端的类
class ClientApi {
  //
  /**
   * 更改 web 页面的背景颜色
   * @param {string} color
   */
  changeBgColor(color) {
    document.body.style.backgroundColor = color;
  }
  console = console;
}

let cpc = await connect();
let serverApi = cpc.genCaller();

let res = await serverApi.log();
console.log(res);
