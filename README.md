## CPCALL

**与协议无关的为 JavaScript 设计的远程过程调用库**

**目前尚不稳定，可能会有较大的破坏性变更**

### 特性

- 与协议无关的为，可用于 TCP、IPC、WebSocket 等
- 类型安全
- 数据交换采用 [JBOD](https://github.com/asnowc/jbod) 编码，相比与 JSON 拥有更多的数据类型，更小的数据帧大小

### 使用

首先定义服务

service_server.ts (运行在服务端，提供给客户端调用)

```ts
class SubService {
  mul(a: number, b: number) {
    return a * b;
  }
}
export class ServerService {
  sub = new SubService();
  calc(a: number, b: number) {
    return a + b;
  }
  getData() {
    return {
      regExp: /abc/,
      map: new Map([
        [1, 2],
        [3, 4],
      ]),
      set: new Set([1, 2, 3, 4]),
    };
  }
}
```

service_client.ts (运行在客户端，提供给服务端调用)

```ts
export class ClientService {
  getData(id: number) {
    return "ok" + id;
  }
}
```

#### 基于 TCP 的示例

##### Node

server.ts

```ts
import { createServer } from "node:net";
import { createSocketCpc } from "cpcall/node";
import { ServerService } from "./service_server.js";
import type { ClientService } from "./service_client.js"; //仅导入类型

const server = createServer(async (socket) => {
  console.log("server", "connected");

  socket.on("close", () => console.log("server close"));
  const serverCpc = createSocketCpc(socket);
  serverCpc.setObject(new ServerService());
  const caller = serverCpc.genCaller<ClientService>(); //配置类型，获取客户端完整的类型提示

  const msg = await caller.getData(8);
  console.log("server", msg);

  serverCpc.caller.end(); //结束调用
  await serverCpc.$close();
  server.close();
});
server.listen(8888);
```

client.ts

```ts
import { connect } from "node:net";
import { createSocketCpc } from "cpcall/node";
import type { ServerService } from "./service_server.js"; //仅导入类型
import { ClientService } from "./service_client.js";

const clientSocket = connect({ port: 8888, host: "127.0.0.1" });

clientSocket.on("connect", async () => {
  console.log("client", "connected");
  const clientCpc = createSocketCpc(clientSocket);
  clientCpc.setObject(new ClientService()); //客户端设置服务，可由服务端主动调用

  const caller = clientCpc.genCaller<ServerService>(); //配置类型，获取服务端完整的类型提示
  const data1 = await caller.getData();
  console.log("client", data1);
  const data2 = await caller.sub.mul(3, 5); //15
  console.log("client", data2);

  clientCpc.caller.end(); //结束调用
  await clientCpc.$close(); //等待 socket 销毁
});
clientSocket.on("close", () => console.log("client close"));
```

##### Deno

server

```ts
import { createWebStreamCpc } from "npm:cpcall/web";

const server = Deno.listen({ port: 8888 });
for await (const conn of server) {
  const cpc = createWebStreamCpc(conn);
  // ...
}
```

client

```ts
import { createWebStreamCpc } from "npm:cpcall/web";

const conn = await Deno.connect({ port: 8888 });
const cpc = createWebStreamCpc(conn);
// ...
```
