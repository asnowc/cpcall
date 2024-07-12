# 使用装饰器

[ECMA 装饰器](https://github.com/tc39/proposal-decorators) 目前处于 Stage 3。 如果使用，至少需要在 TypeScript 5.2

如果你的运行环境不支持 ECMA 装饰器，可以使用 [manualDecorateClass](#manualDecorateClass) 方法手动装饰类

下面的实例中 cpc1 和 cpc2 时一对互相连接的 CpCall 实例

## 定义服务

```ts
@RpcService()
class Service1 {
  //  设置了拦截器, 进行参数转换
  @RpcInterceptCall((args) => {
    return args.map((item) => {
      return (item *= 2);
    });
  })
  @RpcInterceptReturn((res) => res + "-r") // 返回拦截器
  @RpcExposed()
  method1(p: number): string {
    return p + "-res";
  }

  @RpcExposed() // 暴露属性
  property = () => {
    return "result";
  };

  // 没有标记 RpcExposed 不会被暴露
  method2() {
    return 1;
  }
}

cpc2.setObject(new Service1());

const service1 = cpc1.genCaller<Service1>();

await expect(service1.property()).resolves.toBe("result");
await expect(service1.method1(1), "经过了拦截器").resolves.toBe("2-res-r");

await expect(service1.method2(), "method2 没有显示定义").rejects.toThrowError();
```

## @RpcService()

下面定义了 3 个类
Include 标注了 @RpcService(ServiceDefineMode.include)
Exclude 标注了 @RpcService(ServiceDefineMode.exclude)
Common 没有任何标注

```ts
@RpcService()
class Include {
  constructor() {}
  @RpcExposed()
  method1() {
    return 1;
  }

  @RpcExposed()
  method2() {
    return 2;
  }

  method3() {
    return 3;
  }
  /** 标注了排除 */
  @rpcExclude
  method4() {
    return 4;
  }
}

@RpcService(ServiceDefineMode.exclude)
class Exclude {
  method1() {
    return 1;
  }
  /** 标注了排除 */
  @rpcExclude
  method2() {
    return 2;
  }
}
class Common {
  method1() {
    return 1;
  }
  method2() {
    return 1;
  }
}
```

标注 @RpcService(RpcDefineMode.include)：当前类和父类只有标注了 @RpcExposed() 才会暴露

```ts
@RpcService()
class A extends Include {
  @rpcExclude //排除父类暴露的方法
  method2 = super.method2;
}

cpc2.setObject(new A());
const a = cpc1.genCaller<A>();

await expect(a.method1(), "调用继承方法，继承方法已经标记暴露").resolves.toBe(1);
await expect(a.method2(), "调用继承方法，子类已排除").rejects.toThrowError();
await expect(a.method3(), "method3 在父类没有被标记").rejects.toThrowError();
await expect(a.method4(), "method4 在父类标记了排除").rejects.toThrowError();
```

```ts
@RpcService()
class A extends Exclude {}

cpc2.setObject(new A());
const a = cpc1.genCaller<A>();

await expect(a.method1(), "method1 没有标注").rejects.toThrowError();
await expect(a.method2(), "method2 标注了排除").rejects.toThrowError();
```

标注 @RpcService(RpcDefineMode.exclude)：当前类和父类只有标注了 @rpcExclude 才不会被暴露

```ts
@RpcService(ServiceDefineMode.exclude)
class A extends Include {
  method5() {
    return 5;
  }
}

cpc2.setObject(new A());
const a = cpc1.genCaller<A>();

await expect(a.method5(), "method2 在父类中标记暴露").resolves.toBe(5);
await expect(a.method2(), "method2 在父类中标记暴露").resolves.toBe(2);
await expect(a.method3(), "method2 在父类中没有被标记").resolves.toBe(3);
await expect(a.method4(), "method4 在父类中已标记排除，应抛出异常").rejects.toThrowError();
```

普通类，没有标注 @RpcService(): 会继承父类的标注信息

## manualDecorateClass

```ts
class A {
  method1() {
    return 1;
  }
  method2() {
    return 2;
  }
  method3() {
    return 2;
  }
}
manualDecorateClass(A, RpcService(), {
  method1: [RpcExposed(), RpcInterceptReturn((res: number) => "InterceptReturn")],
  method2: RpcExposed(),
});

cpc2.setObject(new A());
const a = cpc1.genCaller<A>();
await expect(a.method1()).resolves.toBe("InterceptReturn");
await expect(a.method2()).resolves.toBe(2);
await expect(a.method3(), "method3 没有被标记").rejects.toThrowError();
```
