import { CpCall, CpcController, CpcFrameSource, RpcFrame } from "cpcall";
import { vi } from "vitest";

/** 用于控制传输数据帧给 CpCall 的实例   */
export class MockCpCall extends CpCall {
  constructor() {
    let controller: CpcController<RpcFrame>;
    const source = {
      close: vi.fn(),
      dispose: vi.fn(),
      sendFrame: vi.fn(),
      init: (ctrl) => (controller = ctrl),
    } satisfies CpcFrameSource;
    super(source);
    this.mockSource = source;
    this.ctrl = controller!;
  }
  /** 构造 CpCall 的 CpcFrameSource  */
  mockSource;
  /** cpc 实例的控制器 */
  ctrl: CpcController<RpcFrame>;
}
