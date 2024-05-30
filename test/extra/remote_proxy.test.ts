import { test, expect, vi, beforeEach } from "vitest";
import { CpCall } from "cpcall";
import { MockCpcFrameSource } from "../__mocks__/CpcMockControl.ts";

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

const { cpc } = createCpc();
const mockCaller = {
  call: vi.fn((...args: any[]) => args),
  exec: vi.fn(),
  end: vi.fn(async () => {}),
};
(cpc as any).caller = mockCaller;

beforeEach(() => {
  mockCaller.call.mockRestore();
});

test("空调用", async function () {
  const caller = cpc.genCaller<TopCall>();
  expect(caller).toThrowError();
});

test("链式远程调用", async function () {
  const caller = cpc.genCaller<TopCall>();
  let res: any = caller.cd("a", true);
  expect(res).toEqual(["cd", "a", true]);

  res = caller.sub.ef();
  expect(res).toEqual(["sub.ef"]);
});
test("原型", async function () {
  const caller = cpc.genCaller<TopCall>();

  await caller.sub[Symbol.asyncDispose]();
  expect(mockCaller.end).toBeCalledWith();
});

test("异步函数中传递", async function () {
  // 注意： 在异步函数中 await 和 return 会获取 then 属性，如果 then 是 function 类型会被自动并执行
  expect(cpc.genCaller().then).not.toBeTypeOf("function");
  expect(cpc.genCaller().sub.then).not.toBeTypeOf("function");
});
test("exec", function () {
  const remote = cpc.genCaller<TopCall>();
  const res = CpCall.exec(remote.cd, "s");

  expect(res).toBeUndefined();
  expect(mockCaller.exec).toBeCalledWith("cd", "s");
});

function createCpc() {
  const onSendFrame = vi.fn();
  let hd = new MockCpcFrameSource();
  let cpc = new CpCall(hd);
  return { onSendFrame, hd, cpc };
}
