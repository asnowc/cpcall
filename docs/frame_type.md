### RPC 数据帧格式:

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

调用方发起调用调用时，会向对方发送一个 call 帧，call。call 帧会有一个与之对应的响应帧，这个响应帧的数据，就是本次调用的返回值

对方的响应帧，必定是按顺序发回。也就是说，如果调用方发起了两个 call 帧（c1、和 c2，c1 先发送，然后发送 c2），那么调用方收到的第一个响应帧(r1)，将会与 c1 对应, 第二个响应帧 (r2) 会与 c2 对应

#### exec

与 call 帧类型，不同的是它不会有返回值。
当被调用方收到 exec 帧时，会执行响应的调用。但会忽略响应。

#### 响应帧

响应帧有三个：return、throw、return promise。响应帧与调用帧一一对应，且必须按顺序回复。

##### return

当调用成功执行时, 回复一个 return 帧

##### throw

当调用失后, 回复一个 throw 帧

##### promise

```
|--varints--|
   asyncId
```

当调用是非常耗时的过程时，为了不阻塞其他响应帧，可以回复 Promise 帧，在过程完成处理后，将响应（resolve 帧或 reject 帧）发回。
promise 帧会携带一个 id，id 为 varints 类型。id 由被调用方生成。 resolve 帧或 reject 帧的 id 也是这个 id

#### 状态帧

##### endCall

endCall 帧可以主动发送，也可以被动发送，但只能发送一次
主动发送发生于调用方主动 结束调用时，此时会向对方发送一个 endCall 帧，对方收到 endCall 帧后应立即回复一个 endServe 帧
被动发送发生于收到对方发送的 endServe 帧，此时应立即回复一个 endCall 帧

##### endServe

disable 帧可以主动发送，也可以被动发送，但只能发送一次
主动发送发生于被调用方主动关闭可调用功能，此时会向对方发送一个 endServe 帧，对方收到 endServe 帧后应立即回复一个 endCall 帧
被动发送发生于收到对方发送的 endCall 帧，此时应立即回复一个 endServe 帧

##### resolve

```
|--varints--| |----JBOD----|
   asyncId     resolve arg
```

##### reject

```
|--varints--| |----JBOD----|
   asyncId      reject arg
```
