## CPCALL RPC 数据帧协议

### 数据帧格式:

```
|---8bit---|---n---|
|Frame type|Content|
```

| DEC | BIN  | Frame Name | Content                    | Describe        |
| --- | ---- | ---------- | -------------------------- | --------------- |
| 0   | 0000 |            |                            |                 |
| 1   | 0001 | call       | (JBOD dyArray content)     |                 |
| 2   | 0010 | exec       | (JBOD dyArray content)     |                 |
| 3   | 0011 |            |                            |                 |
| 4   | 0100 |            |                            |                 |
| 5   | 0101 |            |                            |                 |
| 6   | 0110 |            |                            |                 |
| 7   | 0111 |            |                            |                 |
| 8   | 1000 | promise    | (varints)                  | Return Promise  |
| 9   | 1001 | resolve    | (varints) + (JBOD content) | Promise resolve |
| 10  | 1010 | reject     | (varints) + (JBOD content) | Promise reject  |
| 11  | 1011 | return     | (JBOD content)             |                 |
| 12  | 1100 | throw      | (JBOD content)             |                 |

| dec | binary    | Frame type length | content length |
| --- | --------- | ----------------- | -------------- |
| 16  | 0001_0000 |                   |                |
| 17  | 0001_0001 |                   |                |
|     |           |                   |                |
| 20  | 0001_0100 |                   |                |
| 254 | 11111110  | endCall           | 0              |
| 255 | 11111111  | endServe          | 0              |

### All types of content:

#### 调用帧

##### call

调用方发起调用调用时，会向对方发送一个 call 帧，call。call 帧的发送顺序与响应帧的返回顺序相同\
对方的响应帧，必定是按顺序发回。也就是说，如果调用方发起了两个 call 帧（c1、和 c2，c1 先发送，然后发送 c2），那么调用方收到的第一个响应帧(r1)，将会与 c1 对应, 第二个响应帧 (r2) 会与 c2 对应

##### exec

与 call 帧类型，不同的是它不会有返回值。\
当被调用方收到 exec 帧时，会执行响应的调用。但会忽略响应。

#### 返回帧

返回帧又分为响应帧和结果帧\
响应帧包括 return、throw、promise\
结果帧包括 return、throw、resolve、reject\
call 帧的发送顺序与响应帧的返回顺序相同，

##### return

当调用成功执行时, 返回一个 return 帧

##### throw

当调用发生异常时，返回一个 throw 帧

##### promise

如果调用没法立即给出结果，为了不阻塞其他响应帧，应返回一个 promise 帧，在得出结果后，resolve 帧或 reject 帧返回。\
promise 帧会携带一个 id，id 为 varints 类型。id 由被调用方生成。

```
|--varints--|
   asyncId
```

##### resolve

当异步有结果时，解决之前返回 的 promise 帧

```
|--varints--| |----JBOD----|
   asyncId     resolve arg
```

##### reject

当异步调用出现异常时，拒绝之前返回 的 promise 帧

```
|--varints--| |----JBOD----|
   asyncId      reject arg
```

#### 状态帧

##### endCall 和 endServe

cpcall 每方有一个 callerStatus 和 serviceStatus，默认情况下为 0。\
当双方的 serviceStatus=2 且 callerStatus=3 时，close 事件触发，并断开连接

**假设 A 与 B 保持连接，并且 A 先调用 `endCall()`**

当 A 调用 `endCall()` 时，会向对方发送一个 endCall 帧，此时 A 的 callerStatus=1\
B 收到 endCall 帧后，B 的 serveStatus=1 , 然后立即返回一个 endServe 帧\
A 收到 endServe 帧后，callerStatus=2

当 B 的所有异步结果全部返回后， B 的 serviceStatus=2\
当 A 等待的所有异步结果全部敲定后，A 的 callerStatus=3

**假设 A 与 B 保持连接，并且 A 先调用 `endServe()`**

当 A 调用 `endServe()` 时，会向对方发送一个 endServe 帧，此时 A 的 serveStatus=1\
B 收到 endServe 帧后，B 的 callerStatus=2 , 然后立即返回一个 endCall 帧

当 A 的所有异步结果全部返回后， A 的 serviceStatus=2\
当 B 等待的所有异步结果全部敲定后， B 的 callerStatus=3
