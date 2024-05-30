import { CpcController, RpcFrame, CpcFrameSource } from "cpcall";
import { vi } from "vitest";

export class MockCpcFrameSource implements CpcFrameSource<RpcFrame>, CpcController {
  init(controller: CpcController): void {
    this.nextFrame = controller.nextFrame;
    this.endFrame = controller.endFrame;
  }
  close = vi.fn();
  dispose = vi.fn();
  sendFrame = vi.fn();
}
export interface MockCpcFrameSource extends CpcController {}
