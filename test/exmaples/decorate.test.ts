import { describe, expect } from "vitest";
import {
  RpcService,
  RpcExposed,
  ServiceDefineMode,
  rpcExclude,
  UnregisteredMethodError,
  RpcInterceptCall,
  RpcInterceptReturn,
  manualDecorateClass,
} from "cpcall";
import { cpcTest as test } from "../env/cpc.env.ts";
test("装饰器", async function ({ cpcSuite }) {
  const { cpc1, cpc2 } = cpcSuite;

  @RpcService()
  class Service1 {
    //  设置了拦截器
    @RpcInterceptCall((args) => {
      return args.map((item) => {
        return (item *= 2);
      });
    })
    @RpcInterceptReturn((res) => res + "-r")
    @RpcExposed()
    method1(p: number): string {
      return p + "-res";
    }

    @RpcExposed() // 暴露属性
    property = () => {
      return "result";
    };

    // 不会被暴露
    method2() {
      return 1;
    }
  }

  cpc2.setObject(new Service1());

  const service1 = cpc1.genCaller<Service1>();

  await expect(service1.property()).resolves.toBe("result");
  await expect(service1.method1(1), "经过了拦截器").resolves.toBe("2-res-r");

  await expect(service1.method2(), "method2 没有显示定义").rejects.toThrowError();
});
describe("继承", function () {
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

  test("service 继承 service", async function ({ cpcSuite }) {
    const { cpc1, cpc2 } = cpcSuite;
    /**
     * 父类和子类只有标注为暴露才会暴露
     */
    @RpcService()
    class A extends Include {
      @rpcExclude //排除父类暴露的方法
      method2 = super.method2;
    }

    cpc2.setObject(new A());
    const a = cpc1.genCaller<A>();

    await expect(a.method1(), "调用继承方法，继承方法已经标记暴露").resolves.toBe(1);
    await expect(a.method2(), "调用继承方法，子类已排除").rejects.toThrowError(new UnregisteredMethodError("method2"));
    await expect(a.method3(), "method3 在父类没有被标记").rejects.toThrowError(new UnregisteredMethodError("method3"));
    await expect(a.method4(), "method4 在父类标记了排除").rejects.toThrowError(new UnregisteredMethodError("method4"));
  });
  test("service 继承 普通类", async function ({ cpcSuite }) {
    const { cpc1, cpc2 } = cpcSuite;

    @RpcService()
    class A extends Common {}

    cpc2.setObject(new A());
    const a = cpc1.genCaller<A>();

    await expect(a.method1(), "method1 没有在子类或父类标注，应抛出异常").rejects.toThrowError(
      new UnregisteredMethodError("method1")
    );
  });
  test("service 继承 排除类", async function ({ cpcSuite }) {
    const { cpc1, cpc2 } = cpcSuite;

    @RpcService()
    class A extends Exclude {}

    cpc2.setObject(new A());
    const a = cpc1.genCaller<A>();

    await expect(a.method1(), "method1 没有标注").rejects.toThrowError();
    await expect(a.method2(), "method2 标注了排除").rejects.toThrowError();
  });
  test("排除类 继承 排除类", async function ({ cpcSuite }) {
    const { cpc1, cpc2 } = cpcSuite;

    //C类的所有方法包括父类的所以方法都被暴露
    class A extends Exclude {
      method5() {
        return 5;
      }
    }

    cpc2.setObject(new A());
    const a = cpc1.genCaller<A>();

    await expect(a.method5(), "子类方法 method5 没有标记").resolves.toBe(5);
    await expect(a.method1(), "method1 标记了暴露").resolves.toBe(1);
    await expect(a.method2(), "method2 被标记了排除").rejects.toThrowError();
  });
  test("排除类继承 service", async function ({ cpcSuite }) {
    const { cpc1, cpc2 } = cpcSuite;

    /**
     * 除非标记排除，否则所有方法包括父类的方法都会被暴露
     */
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
  });
  /* 
    
      普通类继承 Service 或排除类。会顺带继承其装饰器
    */
});

test("manualDecorateClass", async function ({ cpcSuite }) {
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

  const { cpc1, cpc2 } = cpcSuite;

  cpc2.setObject(new A());
  const a = cpc1.genCaller<A>();
  await expect(a.method1()).resolves.toBe("InterceptReturn");
  await expect(a.method2()).resolves.toBe(2);
  await expect(a.method3(), "method3 没有被标记").rejects.toThrowError();
});
