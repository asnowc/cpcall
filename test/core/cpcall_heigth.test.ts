import { describe, test, expect, vi, beforeEach } from "vitest";
import { RpcFrame, CpCall } from "cpcall";
import { PassiveDataCollector } from "evlib/async";

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

describe("CpCall", function () {
  const onSendFrame = vi.fn();
  let hd = new PassiveDataCollector<RpcFrame>();
  let cpc = new CpCall(hd.getAsyncGen(), onSendFrame);

  const mockCaller = {
    call: vi.fn(),
  };
  (cpc as any).caller = mockCaller;

  beforeEach(() => {
    mockCaller.call.mockReset();
  });
  test("空调用", async function () {
    const caller = cpc.genCaller<TopCall>();
    expect(caller).toThrowError();
  });
  test("顶级调用", async function () {
    const caller = cpc.genCaller<TopCall>();
    caller.cd("a", true);
    expect(mockCaller.call).toBeCalledWith("cd", "a", true);
  });
  test("子集调用", async function () {
    const caller = cpc.genCaller<TopCall>();
    caller.sub.ef();
    expect(mockCaller.call).toBeCalledWith("sub.ef");
  });
}, 500);
