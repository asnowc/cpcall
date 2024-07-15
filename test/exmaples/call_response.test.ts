import { expect } from "vitest";
import { cpcTest as test } from "../env/cpc.env.ts";

class Service {
  add(a: number, b: number) {
    return a + b;
  }
  multiType(...args: any[]) {
    return args.length;
  }
  getPromise(time: number): Promise<number> {
    return new Promise<number>((resolve) => setTimeout(() => resolve(time), time));
  }
  throwError() {
    throw new Error("throw an error");
  }
  obj = {
    method0() {
      return 0;
    },
    lv1: {
      lv2: {
        method2() {
          return 2;
        },
      },
    },
  };
}

test("调用", async function ({ cpcSuite: { cpc1, cpc2 } }) {
  cpc2.setObject(new Service());

  await expect(cpc1.call("add", 1, 2)).resolves.toBe(3);
  await expect(cpc1.exec("add", 1, 2)).toBe(undefined); // 不需要获取返回值

  const service = cpc1.genCaller<Service>(); // 可以使用代理对象，获得完整类型提示

  await expect(service.add(1, 2)).resolves.toBe(3);
  await expect(service.getPromise(100)).resolves.toBe(100);
  await expect(service.throwError(), "RemoteCallError").rejects.toThrowError("throw an error");

  const args = [
    {
      number: 1,
      bigint: 2n,
      string: "text",
      regExp: /\d+/,
      boolean: true,
      symbol: Symbol("cpcall"),
    },
    undefined,
    null,
    new Uint8Array(10),
    new Error("ha ha"),
    new Set([1, 2, 3]),
    new Map([["str", 1]]),
  ];
  await service.multiType(...args); // 支持许多数据类型

  await expect(service.obj.method0()).resolves.toBe(0);
  await expect(service.obj.lv1.lv2.method2()).resolves.toBe(2); // 深度调用
});
