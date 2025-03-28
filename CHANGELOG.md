## 0.x

### 0.6.x

#### 0.6.8

deps: 移除 jsr 上对 evlib 的依赖

#### 0.6.7

deps: 升级 jbod 到 0.5.1

#### 0.6.6

fix: createWebStreamCpc 内部错误

#### 0.6.5

feat!: CpCall.onClose 的 Promise 现在不再会被拒绝，最终总是被解决的

#### 0.6.4

feat: 新增 `CpCall.genEmitter()`

#### 0.6.3

fix: `CpCall.endServe()` 和 `CpCall.endCall()` 触发调用数据源的 `close()`

#### 0.6.2

#### 0.6.1

Features

- 废弃 createWebsocketCpcOnOpen 改为 createWebSocketCpcOnOpen
- 废弃 `CpCall.setObject`, 改为 `CpCall.exposeObject`
- 新增 CpCall.callable，

#### 0.6.0

Features:

- 新增 ECMA 装饰器，用于定义远程对象

BREAKING CHANGES:

- 删除 `cpcall/web`、`cpcall/node` 模块，现在全部从 `cpcall` 模块导出

- 移除 `CpCall.fromByteIterable`， 独立为 `JbodStreamFrameSource`,
- CpCall 实例重构
- `FrameType.disable` 改为 `FrameTyp. endServe`
- `FrameType.end` 改为 `FrameType.endCall`

- `CpcUnregisteredCommandError` 改为 `UnregisteredMethodError`

- RpcFrame 类型更改，有原来的数组改为对象类型

### 0.5.x

#### 0.5.2

fix(core): 编码 string 类型编码时，遇到较大的 Unicode 时编码错误

#### 0.5.0

BREAKING CHANGE: end(true) 改为 dispose()
BREAKING CHANGE: CpCall 的事件由 OnceEventTrigger 改为 OnceListenable 接口
BREAKING CHANGE: CpCall 构造实现更改，由 RpcFrameCtrl 改为 CpcFrameSource
feat(web): createWebsocketCpcOnOpen

### 0.4.x

#### 0.4.9

fix(web): createWebSocketCpc() 有时永远无法响应

#### 0.4.8

#### 0.4.7

feat(web): createWebSocketCpc() 会合并数据帧再发送
feat(cpc): CpCall.fromByteIterable() 创建的实例会合并数据帧再
feat(core): CpCall.caller.exec() 不会则因为 ended 状态而发生异常

#### 0.4.6

feat(core): CpCall.exec() 和 CpCall.call()\
fix(core): CpCall.setObject() 设置的对象存在循环引用时发生异常

#### 0.4.5

docs: 文档更改

#### 0.4.3

fix(web): WebSocket 无法正常关闭

#### 0.4.2

feat(web): 移除对 dom 类型的引用

#### 0.4.1

feat: 远程调用如果抛出 Error 对象，将自动转为 RemoteCallError

#### 0.4.0

BREAKING CHANGES:
`RpcFrameCtrl.dispose` 返回值不再允许返回 Promise
`CpCall.dispose()` 返回 void
