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

[中文](https://github.com/asnow/cpcall/README.zh.md) | [API](https://jsr.io/@asn/cpcall/doc) | [Examples](#examples)

## Features

- A remote call manipulates the [remote proxy object](#expose-object) with almost the same syntax as a native JavaScript call
- Services can be defined using [ECMA Script decorators](https://github.com/tc39/proposal-decorators). [See the use of decorators](./docs/use_decorator.md)
- It is protocol independent and can be used over TCP, IPC, WebSocket, etc
- Two-way remote call
- By default, [JBOD](https://github.com/asnowc/jbod) binary encoding is used for data transfer. Compared to JSON, it has the following advantages:

  - More data types Examples include bigint, Set, Map, RegExp, Error, UInt8Array, etc. (see [supported data types](https://github.com/asnowc/jbod)), which means that when calling remote methods, you can pass these arguments directly without conversion
  - Smaller data size. For common use cases, the encoded size is about 70% of JSON,
    No need to define data structures, ideal for dynamically typed languages

- No need to define data structures, ideal for dynamically typed languages

## Usage

### Expose globalThis

In the example below, we'll expose the global object on both sides and close the connection after the client calls the server's `console.log()` method

#### Node

tcp server

```ts
import net from "node:net";
import { createSocketCpc } from "cpcall";
const server = new net.Server(async function (socket) {
  const cpc = createSocketCpc(socket);
  cpc.exposeObject(globalThis);
  cpc.onClose.catch(console.error);
});
server.listen(8888);
```

websocket server

```ts
import { WebSocketServer } from "npm:ws";
import http from "node:http";
import { createWebSocketCpcOnOpen } from "cpcall";
const server = new http.Server();
const wsServer = new WebSocketServer({ server });
wsServer.on("connection", async (ws) => {
  const cpc = await createWebSocketCpcOnOpen(ws);
  cpc.exposeObject(globalThis);
  cpc.onClose.catch(console.error);
});
server.listen(8887);
```

tcp client

```ts
import { connect, Socket } from "node:net";
import { createSocketCpc } from "cpcall";

const socket = connect(8888);
socket.on("connect", async () => {
  const cpc = createSocketCpc(socket);
  const remote = cpc.genCaller<typeof globalThis>();
  await remote.console.log("ha ha");
  await cpc.close();
});
```

#### Deno

tcp server

```ts
import { createWebStreamCpc } from "jsr:@asn/cpcall";

const server = Deno.listen({ port: 8888 });
for await (const conn of server) {
  const cpc = createWebStreamCpc(conn);
  cpc.exposeObject(globalThis);
  cpc.onClose.catch(console.error);
}
```

http server

```ts
import { createWebSocketCpcOnOpen } from "jsr:@asn/cpcall";

Deno.serve({ port: 8887 }, function (req, res): Response {
  const upgrade = req.headers.get("upgrade") || "";
  if (upgrade.toLowerCase() != "websocket") {
    return new Response("hi");
  }
  const { response, socket } = Deno.upgradeWebSocket(req);
  createWebSocketCpcOnOpen(socket).then((cpc): void => {
    cpc.exposeObject(globalThis);
    cpc.onClose.catch(console.error);
  }, console.error);
  return response;
});
```

tcp client

```ts
import { createWebStreamCpc } from "jsr:@asn/cpcall";

const conn = await Deno.connect({ port: 8888 });
const cpc = createWebStreamCpc(conn);
cpc.exposeObject(globalThis);

const remote = cpc.genCaller<typeof globalThis>();
await remote.console.log("ha ha");
await cpc.close();
```

#### Browser

```ts
import { createWebSocketCpcOnOpen } from "https://esm.sh/cpcall";

const ws = new WebSocket("ws://127.0.0.1:8887");
const cpc = await createWebSocketCpcOnOpen(ws);
cpc.exposeObject(globalThis);
const remote = cpc.genCaller<typeof globalThis>();
await remote.console.log("ha ha");

await cpc.close();
```

### Expose object

The following example shows the invocation of the proxy object

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

### More Examples

[The use of decorators](https://github.com/asnowc/cpcall/blob/main//docs/use_decorator.md)\
Custom datagram serialization (documentation to be supplemented)\
Implementing a CpCall over http via the CpCall class (documentation to be supplemented)\
[More Examples](https://github.com/asnowc/cpcall/blob/main/example/README.md)

## Concepts

### Remote Procedure Call (RPC)

<img src="https://github.com/asnowc/cpcall/raw/main/docs/img/rpc_flowsheet.png">

### Differences with [tRpc](https://trpc.io/)、[gRpc](https://grpc.io/)、[socket.io](https://socket.io/)

One of the most direct differences between tRpc and gRpc is that tRpc and gRpc are both modeled as a client initiating requests (calls) and the server responding, which means they can only initiate requests in one direction. However, cpcall can initiate calls in both directions.

| Name   | Protocol based                             | Direction of call |
| ------ | ------------------------------------------ | ----------------- |
| tRpc   | http                                       | One-way call      |
| gRpc   | http2                                      | One-way call      |
| cpcall | Two-way streaming (protocol independent)） | Two-way call      |

Socket.io is a WebSocket-based library that enables bidirectional real-time communication between two ends. It provides behaviors such as unicast and multicast. The publish-subscribe pattern is mainly used when working with it.

While cpCall is an end-to-end bidirectional calling RPC library. Essentially, cpCall and socket.io are not libraries of the same type, but under the WebSocket protocol, they can both achieve similar behaviors.

## Others

[CPCALL Data frame protocol](https://github.com/asnowc/cpcall/blob/main/docs/frame_type.md)
