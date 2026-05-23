import { expect } from "vitest";
import {
  RemoteCallError,
  rpcExclude,
  RpcExposed,
  RpcInterceptCall,
  RpcInterceptReturn,
  RpcService,
  ServiceDefineMode,
  UnregisteredMethodError,
} from "cpcall";
import { cpcTest as test } from "../env/cpc.env.ts";
test("@RpcService() 装饰的类只有装饰了 RpcExposed() 的方法或属性会被暴露", async function ({ cpcSuite }) {
  const { cpc1, cpc2 } = cpcSuite;

  @RpcService()
  class Service {
    @RpcExposed()
    exposedMethod() {
      return "exposed";
    }
    hiddenMethod() {
      return "hidden";
    }
    @RpcExposed()
    exposedAtt = () => {
      return "exposedAtt";
    };
    hiddenAtt = () => {
      return "hiddenAtt";
    };
  }

  cpc2.exposeObject(new Service());

  await expect(cpc1.call("exposedMethod")).resolves.toBe("exposed");
  await expect(cpc1.call("hiddenMethod")).rejects.toThrow(
    creteRemoteCallError(new UnregisteredMethodError("hiddenMethod")),
  );
  await expect(cpc1.call("exposedAtt")).resolves.toBe("exposedAtt");
  await expect(cpc1.call("hiddenAtt")).rejects.toThrow(
    creteRemoteCallError(new UnregisteredMethodError("hiddenAtt")),
  );
});
test(
  "@RpcService(ServiceDefineMode.exclude)  装饰的类型只有装饰了 rpcExclude 的方法或属性才不会被暴露 ",
  async function ({
    cpcSuite,
  }) {
    const { cpc1, cpc2 } = cpcSuite;

    @RpcService(ServiceDefineMode.exclude)
    class Service {
      exposedMethod() {
        return "exposed";
      }
      @rpcExclude
      hiddenMethod() {
        return "hidden";
      }
      exposedAtt = () => {
        return "exposedAtt";
      };
      @rpcExclude
      hiddenAtt = () => {
        return "hidden";
      };
    }

    cpc2.exposeObject(new Service());

    await expect(cpc1.call("exposedMethod")).resolves.toBe("exposed");
    await expect(cpc1.call("hiddenMethod")).rejects.toThrow(
      creteRemoteCallError(new UnregisteredMethodError("hiddenMethod")),
    );
    await expect(cpc1.call("exposedAtt")).resolves.toBe("exposedAtt");
    await expect(cpc1.call("hiddenAtt")).rejects.toThrow(
      creteRemoteCallError(new UnregisteredMethodError("hiddenAtt")),
    );
  },
);

test("可以通过 @RpcInterceptCall() 装饰器设置参数拦截器", async function ({ cpcSuite }) {
  const { cpc1, cpc2 } = cpcSuite;

  @RpcService()
  class Service {
    @RpcInterceptCall((args) => args.map((arg) => arg * 2))
    @RpcExposed()
    method(value: number) {
      return value;
    }
  }

  cpc2.exposeObject(new Service());

  await expect(cpc1.call("method", 5)).resolves.toBe(10);
});
test("可以通过 @RpcInterceptReturn() 装饰器设置响应拦截器", async function ({ cpcSuite }) {
  const { cpc1, cpc2 } = cpcSuite;

  @RpcService()
  class Service {
    @RpcInterceptReturn((result) => `${result}-intercepted`)
    @RpcExposed()
    method() {
      return "result";
    }
  }

  cpc2.exposeObject(new Service());

  await expect(cpc1.call("method")).resolves.toBe("result-intercepted");
});

test("子服务", async function ({ cpcSuite }) {
  const { cpc1, cpc2 } = cpcSuite;

  @RpcService()
  class Service1 {
    // 不会被暴露
    obj1 = {
      method() {
        return 1;
      },
    };
    // 会被暴露
    @RpcExposed()
    obj2 = {
      method() {
        return 1;
      },
    };
    service2 = new Service2(); // service2不会被暴露

    @RpcExposed()
    service3 = new Service2(); // service3 会被暴露
  }
  @RpcService(ServiceDefineMode.exclude) // 排除模式
  class Service2 {
    s2Method3() {
      return 1;
    }
    // 不会被暴露
    @rpcExclude
    s2Method2() {
      return 1;
    }
  }

  cpc2.exposeObject(new Service1());
  await expect(cpc1.call("obj2.method")).resolves.toBe(1);
  await expect(cpc1.call("service3.s2Method3")).resolves.toBe(1);

  await expect(cpc1.call("obj1.method"), "obj1 没有被标记暴露").rejects.toThrow(
    creteRemoteCallError(new UnregisteredMethodError("obj1.method")),
  );
  await expect(cpc1.call("service2.s2Method3"), "service2 没有被标记暴露，应无法调用").rejects.toThrow(
    creteRemoteCallError(new UnregisteredMethodError("service2.s2Method3")),
  );
  await expect(cpc1.call("service3.s2Method2"), "s2Method2标记了排除，应无法调用").rejects.toThrow(
    creteRemoteCallError(new UnregisteredMethodError("service3.s2Method2")),
  );
});
function creteRemoteCallError(err: Error) {
  return new RemoteCallError(err.message);
}
