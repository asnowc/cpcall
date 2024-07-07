import { test, vi } from "vitest";
import { CpCall, CpcFrameSource, CpcController, RpcFrame } from "cpcall";

function mockConnectedCpc() {
  let c1Controller: CpcController<RpcFrame>;

  let c2Controller: CpcController<RpcFrame>;
  const cpc1Src = {
    close: vi.fn(() => {
      Promise.resolve(() => {
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
  cpcSuite: ReturnType<typeof mockConnectedCpc>;
  cpcHandle: CpcHandle;
}
export const cpcTest = test.extend<CpcTestContext>({
  async cpcSuite({}, use) {
    await use(mockConnectedCpc());
  },
  async cpcHandle({}, use) {
    await use(createCpcHandle());
  },
});

class CpcHandle {
  cpc!: CpCall;
  source = {
    close: vi.fn(),
    dispose: vi.fn(),
    sendFrame: vi.fn(),
    init: vi.fn(),
  } satisfies CpcFrameSource;
  ctrl!: CpcController<RpcFrame>;
}
function createCpcHandle(): CpcHandle {
  const hd: CpcHandle = new CpcHandle();
  hd.source.init.mockImplementation((controller) => {
    hd.ctrl = controller;
  });
  const cpc = new CpCall(hd.source);
  hd.cpc = cpc;
  return hd;
}
