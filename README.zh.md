## Features

- 远程调用可操作[远程代理对象](#expose-object)，与原生 JavaScript 调用语法几乎无差别
- 可使用 [ECMA 装饰器](https://github.com/tc39/proposal-decorators)定义服务。 [查看装饰器的使用](./docs/use_decorator.md)
- 与协议无关，可基于 TCP、IPC、WebSocket 等
- 类型安全
- 双端远程调用
- 数据传输默认采用 [JBOD](https://github.com/asnowc/jbod) **二进制**编码。相比 JSON，有如下优势：
  - 更多的数据类型。如 bigint、Set、Map、RegExp、Error、UInt8Array 等（查看[支持的数据类型](https://github.com/asnowc/jbod)），这意味着在调用远程方法时，你可以直接传递这些参数，而无需进行转换
  - 更小的数据大小。对于常见场景，编码后大小 大概是 JSON 的 70%，
- 无需定义数据结构，非常适合动态类型语言

## Usage

### Expose globalThis

下面的示例中，Alice 作为客户端，Bob 作为服务端。它们分别向对方暴露了全局对象，并相互调用了对方的 `console.log()` 方法后结束调用。

#### Node

Bob: tcp server

```ts
import net from "node:net";
import { CpCall, createSocketCpc } from "cpcall";

async function onRpcConnected(cpc: CpCall) {
  cpc.exposeObject(globalThis);
  const remoteAlice = cpc.genCaller();
  await remoteAlice.console.log("Bob called Alice");
  await cpc.endCall();
}

const server = new net.Server((socket) => {
  const cpc = createSocketCpc(socket);
  onRpcConnected(cpc);
});
server.listen(8888);
```

Alice: tcp client

```ts
import { connect } from "node:net";
import { createSocketCpc } from "cpcall";

const socket = connect(8888);
socket.on("connect", async () => {
  const cpc = createSocketCpc(socket);
  const remote = cpc.genCaller<typeof globalThis>();

  await remote.console.log("Alice Called Bob");

  await cpc.endCall();
});
```

#### Deno

Bob: tcp server

```ts
import { CpCall, createWebStreamCpc } from "cpcall";

async function onRpcConnected(cpc: CpCall) {
  cpc.exposeObject(globalThis);
  const remoteAlice = cpc.genCaller();
  await remoteAlice.console.log("Bob called Alice");
  await cpc.endCall();
}

const server = Deno.listen({ port: 8888 });
for await (const conn of server) {
  const cpc = createWebStreamCpc(conn);
  onRpcConnected(cpc);
}
```

Alice: TCP client

```ts
import { createWebStreamCpc } from "cpcall";

async function connTcpCpc() {
  const conn = await Deno.connect({ port: 8888 });
  const cpc = createWebStreamCpc(conn);
  cpc.exposeObject(globalThis);

  const remoteBob = cpc.genCaller<typeof globalThis>();
  await remoteBob.console.log("Alice called bob");

  await cpc.endCall();
}

await connTcpCpc();
```

#### Browser

Bob: websocket server。服务端由 deno 或 node 实现

```ts
async function onRpcConnected(cpc: CpCall) {
  cpc.exposeObject(globalThis);
  const remoteAlice = cpc.genCaller();
  await remoteAlice.console.log("Bob called Alice");
  await cpc.endCall();
}
```

Deno http 服务

```ts
import { CpCall, createWebSocketCpcOnOpen } from "cpcall";
Deno.serve({ port: 8887 }, function (req, res): Response {
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() != "websocket") {
    return new Response("hi");
  }
  const { response, socket } = Deno.upgradeWebSocket(req);
  createWebSocketCpcOnOpen(socket).then(onRpcConnected, console.error);
  return response;
});
```

Node http 服务

```ts
import { WebSocketServer } from "npm:ws";
import http from "node:http";
import { CpCall, createWebSocketCpcOnOpen } from "cpcall";

const server = new http.Server();
const wsServer = new WebSocketServer({ server });
wsServer.on("connection", async (ws) => {
  createWebSocketCpcOnOpen(ws).then(onRpcConnected);
});
server.listen(8887);
```

Alice: websocket client

```ts
import { createWebSocketCpcOnOpen } from "https://esm.sh/cpcall@0.6.x";

async function connectWsCpc() {
  const ws = new WebSocket("ws://127.0.0.1:8887");
  const cpc = await createWebSocketCpcOnOpen(ws);
  cpc.exposeObject(globalThis);
  const remote = cpc.genCaller<typeof globalThis>();
  await remote.console.log("Alice called Bob");

  await cpc.endCall();
}

connectWsCpc();
```

### Expose object

下面的示例中，展示了代理对象的调用

server.ts

```ts
class Service {
  add(a: number, b: number) {
    return a + b;
  }
  multiType(...args: any[]) {
    return args.length;
  }
  getPromise(time: number): Promise<number> {
    return new Promise<number>((resolve) => setTimeout(() => resolve(time), time));
  }
  throwError() {
    throw new Error("throw an error");
  }
  obj = {
    method0() {
      return 0;
    },
    lv1: {
      lv2: {
        method2() {
          return 2;
        },
      },
    },
  };
}

cpc.exposeObject(new Service());

export type { Service };
```

client.ts

```ts
import type { Service } from "./server.ts";

await cpc1.call("add", 1, 2);
cpc1.exec("add", 1, 2); // No need to retrieve the return value

const service = cpc1.genCaller<Service>(); // Use proxy objects to obtain complete type prompts

await service.add(1, 2);
await service.getPromise(100);
await service.throwError().catch((e) => {
  console.log(e); // Error: throw an error
});

const args = [
  {
    number: 1,
    bigint: 2n,
    string: "text",
    regExp: /\d+/,
    boolean: true,
    symbol: Symbol("cpcall"),
  },
  undefined,
  null,
  new Uint8Array(10),
  new Error("ha ha"),
  new Set([1, 2, 3]),
  new Map([["str", 1]]),
];
await service.multiType(...args); // Supports many data types

await service.obj.method0();
await service.obj.lv1.lv2.method2(); // Deep call
```

### 更多示例

[装饰器的使用](https://github.com/asnowc/cpcall/blob/main//docs/use_decorator.md)\
自定义数据帧序列化（文档待补充）\
通过 CpCall 类 实现一个基于 http 的 CpCall（文档待补充）\
[更多示例](https://github.com/asnowc/cpcall/blob/main/example/README.md)

## 概念

### 远程过程调用（RPC）

<img src="https://github.com/asnowc/cpcall/raw/main/docs/img/rpc_flowsheet.png">

### 与 [tRpc](https://trpc.io/)、[gRpc](https://grpc.io/)、[socket.io](https://socket.io/) 的区别

与 tRpc、gRpc 最直接的一个区别是，tRpc、gRpc 都是通过客户端主动发起请求(调用)，服务端进行响应，的模式，他们只能单向发起调用。而 cpcall，可以进行双向相互调用

| 名称   | 基于协议             | 调用方向 |
| ------ | -------------------- | -------- |
| tRpc   | http                 | 单向调用 |
| gRpc   | http2                | 单向调用 |
| cpcall | 双向流（与协议无关） | 双向调用 |

socket.io 是一个基于 WebSocket 的库，可实现双端之间的双向实时通信，它提供了单播、多播等行为。使用它主要用到发布订阅模式。
而 cpcall，是一个端到端双向调用的 RPC 库。cpcall 与 socket.io 本质上不属于同一类型的库，但在 WebSocket 协议下，他们都能达到相似的行为。

## 其他

[CPCALL 数据帧协议](https://github.com/asnowc/cpcall/blob/main/docs/frame_type.md)
