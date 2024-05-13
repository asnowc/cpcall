## 调用-返回

### socket.io

这是 Socket.io 官网的一个示例. [查看示例](https://socket.io/docs/v4/emitting-events/#acknowledgements)

server

```ts
socket.on("update item", (arg1, arg2, callback) => {
  console.log(arg1); // 1
  console.log(arg2); // { name: "updated" }
  callback({ status: "ok" });
});
```

client

```ts
socket.emit("update item", "1", { name: "updated" }, (response) => {
  console.log(response.status); // ok
});
```

### cpcall

server

```ts
cpc.setFn("updateItem", (arg1, arg2) => {
  console.log(arg1); // 1
  console.log(arg2); // { name: "updated" }
  return { status: "ok" };
});
```

client

```ts
//caller 是远程代理对象，由 cpc.genCaller() 生成
const res = await caller.updateItem("1", { name: "updated" });
console.log(res);
```
