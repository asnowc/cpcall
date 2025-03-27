import { expect } from "vitest";
import {
  RpcService,
  RpcExposed,
  ServiceDefineMode,
  rpcExclude,
  UnregisteredMethodError,
  RpcInterceptCall,
  RpcInterceptReturn,
  RemoteCallError,
} from "cpcall";
import { cpcTest as test } from "../env/cpc.env.ts";
test("@RpcService() 装饰的类只有装饰了 RpcExposed() 的方法或属性会被暴露", async function ({ cpcSuite }) {
  const { cpc1, cpc2 } = cpcSuite;

  @RpcService()
  class Service {
    @RpcExposed() exposedMethod() {
      return "exposed";
    }
    hiddenMethod() {
      return "hidden";
    }
    @RpcExposed() exposedAtt = () => {
      return "exposedAtt";
    };
    hiddenAtt = () => {
      return "hiddenAtt";
    };
  }

  cpc2.exposeObject(new Service());
  const service = cpc1.genCaller<Service>();

  await expect(service.exposedMethod()).resolves.toBe("exposed");
  await expect(service.hiddenMethod()).rejects.toThrowError(
    creteRemoteCallError(new UnregisteredMethodError("hiddenMethod"))
  );
  await expect(service.exposedAtt()).resolves.toBe("exposedAtt");
  await expect(service.hiddenAtt()).rejects.toThrowError(
    creteRemoteCallError(new UnregisteredMethodError("hiddenAtt"))
  );
});
test("@RpcService(ServiceDefineMode.exclude)  装饰的类型只有装饰了 rpcExclude 的方法或属性才不会被暴露 ", async function ({
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
    @rpcExclude hiddenAtt = () => {
      return "hidden";
    };
  }

  cpc2.exposeObject(new Service());
  const service = cpc1.genCaller<Service>();

  await expect(service.exposedMethod()).resolves.toBe("exposed");
  await expect(service.hiddenMethod()).rejects.toThrowError(
    creteRemoteCallError(new UnregisteredMethodError("hiddenMethod"))
  );
  await expect(service.exposedAtt()).resolves.toBe("exposedAtt");
  await expect(service.hiddenAtt()).rejects.toThrowError(
    creteRemoteCallError(new UnregisteredMethodError("hiddenAtt"))
  );
});

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
  const service = cpc1.genCaller<Service>();

  await expect(service.method(5)).resolves.toBe(10);
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
  const service = cpc1.genCaller<Service>();

  await expect(service.method()).resolves.toBe("result-intercepted");
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
  const service = cpc1.genCaller<Service1>();

  await expect(service.obj2.method()).resolves.toBe(1);
  await expect(service.service3.s2Method3()).resolves.toBe(1);

  await expect(service.obj1.method(), "obj1 没有被标记暴露").rejects.toThrowError(
    creteRemoteCallError(new UnregisteredMethodError("obj1.method"))
  );
  await expect(service.service2.s2Method3(), "service2 没有被标记暴露，应无法调用").rejects.toThrowError(
    creteRemoteCallError(new UnregisteredMethodError("service2.s2Method3"))
  );
  await expect(service.service3.s2Method2(), "s2Method2标记了排除，应无法调用").rejects.toThrowError(
    creteRemoteCallError(new UnregisteredMethodError("service3.s2Method2"))
  );
});
function creteRemoteCallError(err: Error) {
  return new RemoteCallError(err.message);
}
