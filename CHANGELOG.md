## 0.x

### 0.4.x

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

##### BREAKING CHANGE

`RpcFrameCtrl.dispose` 返回值不再允许返回 Promise
`CpCall.dispose()` 返回 void
