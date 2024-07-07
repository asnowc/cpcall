import { expect, vi, beforeEach } from "vitest";
import { CpCall } from "cpcall";
import { cpcTest as test } from "../env/cpc.env.ts";
import { afterTime } from "evlib";

interface SubCall {
  ab: number;
  cd(a: string, b?: boolean): number;
  ef(): void;
}
interface TopCall {
  ab: number;
  sub: SubCall;
  cd(a: string, b?: boolean): number;
}

test("空调用", async function ({ cpcSuite: { cpc1, cpc2 } }) {
  const caller = cpc1.genCaller<TopCall>();
  expect(caller).toThrowError();
});

test("链式远程调用", async function ({ cpcSuite: { cpc1, cpc2 } }) {
  cpc2.setFn("cd", (...args) => args);
  cpc2.setFn("sub.ef", (...args) => args);
  const caller = cpc1.genCaller<TopCall>();
  await expect(caller.cd("a", true)).resolves.toEqual(["a", true]);
  await expect(caller.sub.ef()).resolves.toEqual([]);
});
test("原型", async function ({ cpcSuite: { cpc1, cpc2 } }) {
  const caller = cpc1.genCaller<TopCall>();
  await caller.sub[Symbol.asyncDispose]();
  expect(cpc1.callerStatus > 0).toBe(true);
});

test("异步函数中传递", async function ({ cpcSuite: { cpc1, cpc2 } }) {
  // 注意： 在异步函数中 await 和 return 会获取 then 属性，如果 then 是 function 类型会被自动并执行
  expect(cpc1.genCaller().then).not.toBeTypeOf("function");
  expect(cpc1.genCaller().sub.then).not.toBeTypeOf("function");
});
test("exec", async function ({ cpcSuite: { cpc1, cpc2 } }) {
  const fn = vi.fn();
  cpc2.setFn("cd", fn);
  const remote = cpc1.genCaller<TopCall>();
  CpCall.exec(remote.cd, "s");
  await afterTime(100);
  expect(fn).toBeCalled();
});
