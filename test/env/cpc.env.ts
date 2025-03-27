import { test, vi } from "vitest";
import { CpCall, CpcFrameSource, CpcController, RpcFrame } from "cpcall";
import { MockCpCall } from "../__mocks__/mock_cpc.ts";

function mockConnectedCpc() {
  let c1Controller: CpcController<RpcFrame>;

  let c2Controller: CpcController<RpcFrame>;
  const cpc1Src = {
    close: vi.fn(() => {
      Promise.resolve().then(() => {
        c2Controller.endFrame();
      });
    }),
    dispose: vi.fn((err) => {
      c2Controller.endFrame(new Error("remote error"));
    }),
    init: vi.fn((controller) => {
      c1Controller = controller;
    }),
    sendFrame: vi.fn(async (frame) => {
      Promise.resolve().then(() => {
        c2Controller.nextFrame(frame);
      });
    }),
  } satisfies CpcFrameSource;

  const cpc1 = new CpCall(cpc1Src) as CpCall & { debugName: string };
  cpc1.debugName = "client";

  const cpc2Src = {
    close: vi.fn(() => {
      Promise.resolve(() => {
        c1Controller.endFrame();
      });
    }),
    dispose: vi.fn(() => {
      c1Controller.endFrame(new Error("remote error"));
    }),
    init: vi.fn((controller) => {
      c2Controller = controller;
    }),
    sendFrame: vi.fn(async (frame) => {
      Promise.resolve().then(() => {
        c1Controller.nextFrame(frame);
      });
    }),
  } satisfies CpcFrameSource;

  const cpc2 = new CpCall(cpc2Src) as CpCall & { debugName: string };
  cpc2.debugName = "server";

  return { cpc1, cpc2, cpc1Src, cpc2Src };
}

export interface CpcTestContext {
  /** 两个已经建立连接的 CpCall 实例 */
  cpcSuite: ReturnType<typeof mockConnectedCpc>;
  /** 一个模拟 CpCall 实例，通过控制器与与它通信 */
  mockCpc: MockCpCall;
}
export const cpcTest = test.extend<CpcTestContext>({
  async cpcSuite({}, use) {
    await use(mockConnectedCpc());
  },
  async mockCpc({}, use) {
    await use(new MockCpCall());
  },
});
