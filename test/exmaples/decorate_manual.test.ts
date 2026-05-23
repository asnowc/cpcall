import { expect } from "vitest";
import { manualDecorateClass, RpcExposed, RpcInterceptReturn, RpcService } from "cpcall";
import { cpcTest as test } from "../env/cpc.env.ts";

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

  cpc2.exposeObject(new A());
  await expect(cpc1.call("method1")).resolves.toBe("InterceptReturn");
  await expect(cpc1.call("method2")).resolves.toBe(2);
  await expect(cpc1.call("method3"), "method3 没有被标记").rejects.toThrow();
});
