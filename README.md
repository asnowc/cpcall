[![ESM package][package]][package-url]
[![NPM version][npm]][npm-url]
[![JSR version][jsr]][jsr-url]
[![Node version][node]][node-url]
[![Install size][size]][size-url]
[![Build status][build]][build-url]

[package]: https://img.shields.io/badge/package-ESM-ffe536.svg
[package-url]: https://nodejs.org/api/esm.html
[npm]: https://img.shields.io/npm/v/cpcall.svg
[npm-url]: https://npmjs.com/package/cpcall
[jsr]: https://jsr.io/badges/@asn/cpcall
[jsr-url]: https://jsr.io/@asn/cpcall
[node]: https://img.shields.io/node/v/cpcall.svg
[node-url]: https://nodejs.org
[size]: https://packagephobia.com/badge?p=cpcall
[size-url]: https://packagephobia.com/result?p=cpcall
[build]: https://github.com/asnowc/cpcall/actions/workflows/ci.yaml/badge.svg?branch=main
[build-url]: https://github.com/asnowc/cpcall/actions

A protocol independent library designed for remote procedure call (RPC) in JavaScript\
与协议无关的，为 JavaScript 设计的远程过程调用（RPC）的库

**目前版本不稳定，不遵循 semver 语义，可能会有较大的破坏性变更**\
**The current version is unstable and does not follow Semver semantics, which may result in significant destructive changes**

[API](https://jsr.io/@asn/cpcall/doc)
[Examples](#examples)

## Features

- 远程调用可操作[远程代理对象](./docs/remote_proxy_object.md)，与原生 JavaScript 调用语法非常相近
- 可使用 [ECMA 装饰器](https://github.com/tc39/proposal-decorators)定义服务。 [查看装饰器的使用](./docs/use_decorator.md)
- 与协议无关，可用于基于 TCP、IPC、WebSocket 等
- 双向远程调用，客户端可以调用服务端的方法，服务端可以调用客户端的方法
- 数据传输默认采用 [JBOD](https://github.com/asnowc/jbod) 编码。相比 JSON，有如下优势：
  - 更多的数据类型。如 bigint、Set、Map、RegExp、Error、UInt8Array 等（查看[支持的数据类型](https://github.com/asnowc/jbod)），这意味着在调用远程方法时，你可以直接传递这些参数，而无需进行转换
  - 更小的数据大小。对于常见场景，编码后大小比 JSON 小得多，
- 无需定义数据结构，非常适合动态类型语言

## Usage

Node

`npm install cpcall`

```ts
import { createSocketCpc, createWebStreamCpc, createWebSocketCpc } from "cpcall";
```

Deno

```ts
import { createWebStreamCpc, createWebSocketCpc } from "jsr:@asn/cpcall";
```

Browser

```ts
import { createWebStreamCpc, createWebSocketCpc } from "https://esm.sh/cpcall";
```

## 概念

### 远程过程调用（RPC）

RPC（Remote Procedure Call Protocol）远程过程调用协议。
一个通俗的描述是：客户端可以直接调用远程计算机上的对象方法，并得到返回值，就像调用本地应用程序中的对象一样。

下图为从 ProtX 调用远程端 PortY 的 PortYService.methodD() 方法的流程

<img src="./docs/img/rpc_flowsheet.png">

### 与 [tRpc](https://trpc.io/)、[gRpc](https://grpc.io/)、[socket.io](https://socket.io/) 的区别

与 tRpc、gRpc 最直接的一个区别是，tRpc、gRpc 都是通过客户端主动发起请求(调用)，服务端进行响应，的模式，他们只能单向发起调用。而 cpcall，可以进行双向相互调用

| 名称   | 基于协议             | 调用方向 |
| ------ | -------------------- | -------- |
| tRpc   | http                 | 单向调用 |
| gRpc   | http2                | 单向调用 |
| cpcall | 双向流（与协议无关） | 双向调用 |

socket.io 是一个基于 WebSocket 的库，可实现双端之间的双向实时通信，它提供了单播、多播等行为。使用它主要用到发布订阅模式。
而 cpcall，是一个端到端双向调用的 RPC 库。cpcall 与 socket.io 本质上不属于同一类型的库，但在 WebSocket 协议下，他们都能达到相似的行为。

## Examples

### NodeJS TCP 的示例

服务端暴露了一些 API，客户端通过 TCP 连接服务端，然后调用它们

client.ts

```ts
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
```

server.ts

ServerApi 暴露了所有方法，如果希望只暴露其中的一些方法，或者转换参数，可使用 [装饰器标注](./docs/use_decorator.md)

```ts
import { Socket, createServer } from "node:net";
import { createSocketCpc } from "cpcall";

// 这是暴露给客户端调用的类
class ServerApi {
  add(a: number, b: number) {
    const res = a + b;
    console.log(`${a} + ${b} = ${res}`);
    return res;
  }
  async mul(a: number, b: number) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return a * b;
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
```

### Deno TCP 示例

参考 NodJS TCP 示例。这里只展示了如何创建 CpCall 实例
server

```ts
import { createWebStreamCpc } from "npm:cpcall";

const server = Deno.listen({ port: 8888 });
for await (const conn of server) {
  const serverCpc = createWebStreamCpc(conn);
  // ...
}
```

client

```ts
import { createWebStreamCpc } from "npm:cpcall";

const conn = await Deno.connect({ port: 8888 });
const clientCpc = createWebStreamCpc(conn);
// ...
```

### 更多示例

[装饰器的使用](./docs/use_decorator.md)\
[WebSocket 示例](./example/websocket/README.md): 前端暴露一些 API 给后端调用，同时后端也暴露一些 API 给前端调用\
[与 socket.io 的简单比较](./example/cpcall%20vs%20socket.io.md)\
自定义数据帧编解码器（文档待补充）\
通过 CpCall 类 实现一个基于 http 的 CpCall（文档待补充）

## 其他

[CPCALL 数据帧协议](./docs/frame_type.md)
