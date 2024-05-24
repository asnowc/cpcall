import { trans } from "../core/mod.ts";
import { RpcFrame } from "../core/type.ts";
import { RpcFrameCtrl } from "./cpc.ts";

/**
 * 收集发送的帧，在下一个微任务触发发送
 */
export class ByteFrameCtrl implements RpcFrameCtrl {
  constructor(private ctrl: RpcFrameCtrl<Uint8Array>) {
    this.frameIter = trans.createFrameIterator(ctrl.frameIter);
  }
  close(): void | Promise<void> {
    this.ctrl.close?.();
  }
  private link: RpcFrame[] = [];
  dispose(reason?: any): void {
    this.ctrl.dispose?.(reason);
  }
  send() {
    const chunk = trans.packCpcFrames(this.link);
    this.ctrl.sendFrame(chunk);
    this.link.length = 0;
  }
  frameIter: AsyncIterable<RpcFrame>;
  sendFrame(frame: RpcFrame): void {
    if (this.link.length === 0) Promise.resolve().then(() => this.send());
    this.link.push(frame);
  }
}
