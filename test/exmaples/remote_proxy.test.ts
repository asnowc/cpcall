import { expect, vi } from "vitest";
import { CpCall } from "cpcall";
import { cpcTest as test } from "../env/cpc.env.ts";
import { afterTime } from "../utils/time.ts";

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

test("空调用将直接抛出异常", async function ({ cpcSuite: { cpc1, cpc2 } }) {
  const caller = cpc1.genCaller<TopCall>();
  expect(caller).toThrowError();
});

test("可以链式远程调用", async function ({ cpcSuite: { cpc1, cpc2 } }) {
  cpc2.exposeObject({ cd: (...args: any[]) => args, sub: { ef: (...args: any[]) => args } });
  const caller = cpc1.genCaller<TopCall>();
  await expect(caller.cd("a", true)).resolves.toEqual(["a", true]);
  await expect(caller.sub.ef()).resolves.toEqual([]);
});

test("远程代理对象将忽略 then 属性", async function ({ cpcSuite: { cpc1, cpc2 } }) {
  // 注意： 在异步函数中 await 和 return 会获取 then 属性，如果 then 是 function 类型会被自动并执行
  expect(cpc1.genCaller().then).not.toBeTypeOf("function");
  expect(cpc1.genCaller().sub.then).not.toBeTypeOf("function");
});
test("CpCall.exec() 可以直接传入远程代理对象发起 exec 调用", async function ({ cpcSuite: { cpc1, cpc2 } }) {
  const fn = vi.fn();
  cpc2.exposeObject({ cd: fn });
  const remote = cpc1.genCaller<TopCall>();
  CpCall.exec(remote.cd, "s");
  await afterTime(100);
  expect(fn).toBeCalled();
});

test("getEmitter() 生成的远程代理对象将是通过 exec 发起调用", async function ({ cpcSuite: { cpc1, cpc2 } }) {
  const fn = vi.fn();
  cpc2.exposeObject({ cd: fn });
  const remote = cpc1.getEmitter<TopCall>();
  expect(remote.cd("s")).toBeUndefined();
  await afterTime(100);
  expect(fn).toBeCalled();
});
