import { expect } from "vitest";
import { UnregisteredMethodError, RemoteCallError } from "cpcall";
import { cpcTest as test } from "../env/cpc.env.ts";

test("可以调用 getter", async function ({ cpcSuite }) {
  const { cpc1, cpc2 } = cpcSuite;
  cpc2.exposeObject({
    get getterAtt() {
      return () => 10;
    },
  });
  await expect(cpc1.call("getterAtt"), "getter").resolves.toBe(10);
});
test("可以调用同步方法", async function ({ cpcSuite }) {
  const { cpc1, cpc2 } = cpcSuite;
  cpc2.exposeObject({
    methodAtt(this: any) {
      return 9;
    },
  });
  await expect(cpc1.call("methodAtt"), "method").resolves.toBe(9);
});
test("可以调用异步方法", async function ({ cpcSuite }) {
  const { cpc1, cpc2 } = cpcSuite;
  cpc2.exposeObject({
    async methodAtt(this: any) {
      await new Promise((r) => setTimeout(r, 10));
      return 9;
    },
  });
  await expect(cpc1.call("methodAtt"), "method").resolves.toBe(9);
});
test("可以调用子对象", async function ({ cpcSuite }) {
  const { cpc1, cpc2 } = cpcSuite;
  cpc2.exposeObject({
    sub: {
      method() {
        return 1;
      },
    },
  });
  await expect(cpc1.call("sub.method")).resolves.toBe(1);
});

test("循环引用也能调用", async function ({ cpcSuite }) {
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
test("尝试调用非函数将抛出 UnregisteredMethodError 异常", async function ({ cpcSuite }) {
  const { cpc1, cpc2 } = cpcSuite;
  cpc2.exposeObject({ att1: 8, att2: null, att3: "string" });
  await expect(cpc1.call("att1")).rejects.toThrowError(creteRemoteCallError(new UnregisteredMethodError("att1")));
  await expect(cpc1.call("att2")).rejects.toThrowError(creteRemoteCallError(new UnregisteredMethodError("att2")));
  await expect(cpc1.call("att3")).rejects.toThrowError(creteRemoteCallError(new UnregisteredMethodError("att3")));
});

function creteRemoteCallError(err: Error) {
  return new RemoteCallError(err.message);
}
