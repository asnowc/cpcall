import { expect } from "vitest";
import {
  RpcService,
  RpcExposed,
  RpcInterceptCall,
  RpcInterceptReturn,
  CpcUnregisteredCommandError,
  ServiceDefineMode,
  rpcExclude,
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
    m2(p: number): string {
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
  await expect(service1.m2(1), "经过了拦截器").resolves.toBe("2-res-r");

  await expect(service1.method2(), "method2 没有显示定义").rejects.toThrowError();
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

  cpc2.setObject(new Service1());
  const service = cpc1.genCaller<Service1>();

  await expect(service.obj2.method()).resolves.toBe(1);
  await expect(service.service3.s2Method3()).resolves.toBe(1);

  await expect(service.obj1.method(), "obj1 没有被标记暴露").rejects.toThrowError();
  await expect(service.service2.s2Method3(), "service2 没有被标记暴露，应无法调用").rejects.toThrowError();
  await expect(service.service3.s2Method2(), "s2Method2标记了排除，应无法调用").rejects.toThrowError();
});
