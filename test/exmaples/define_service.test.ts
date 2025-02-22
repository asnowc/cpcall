import { expect } from "vitest";
import {
  RpcService,
  RpcExposed,
  ServiceDefineMode,
  rpcExclude,
  UnregisteredMethodError,
  RemoteCallError,
} from "cpcall";
import { cpcTest as test } from "../env/cpc.env.ts";

test("普通对象", async function ({ cpcSuite }) {
  const { cpc1, cpc2 } = cpcSuite;
  const obj = {
    methodAtt(this: any) {
      return this.att;
    },
    att: 9,
    get getterAtt() {
      return () => 10;
    },
    sub: {
      method() {
        return 1;
      },
    },
  };

  cpc2.exposeObject(obj);

  await expect(cpc1.call("methodAtt"), "method").resolves.toBe(9);
  await expect(cpc1.call("getterAtt"), "getter").resolves.toBe(10);
  await expect(cpc1.call("sub.method")).resolves.toBe(1);
});

test("循环引用", async function ({ cpcSuite }) {
  const { cpc1, cpc2 } = cpcSuite;

  const root = {
    sub: {} as any,
    sub2: {
      a: () => 1,
    },
  };
  root.sub = root;

  cpc2.exposeObject(root);

  await expect(cpc1.call("sub.sub.sub.sub2.a")).resolves.toBe(1);
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
test("调用非函数", async function ({ cpcSuite }) {
  const { cpc1, cpc2 } = cpcSuite;
  cpc2.exposeObject({ att1: 8, att2: null, att3: "string" });
  await expect(cpc1.call("att1")).rejects.toThrowError(creteRemoteCallError(new UnregisteredMethodError("att1")));
  await expect(cpc1.call("att2")).rejects.toThrowError(creteRemoteCallError(new UnregisteredMethodError("att2")));
  await expect(cpc1.call("att3")).rejects.toThrowError(creteRemoteCallError(new UnregisteredMethodError("att3")));
});
function creteRemoteCallError(err: Error) {
  return new RemoteCallError(err.message);
}
