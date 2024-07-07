import { createCpcFrameParser, decodeCpcFrame, packCpcFrames } from "../core/mod.ts";
import { RpcFrame } from "../core/type.ts";
import { CpcController, CpcFrameSource } from "./cpc_base.ts";

/**
 * 自动处理二进制帧。它会将 CpCall 在一个宏任务内的生成的帧进行打包
 */
export class CpcByteFrameSource implements CpcFrameSource<RpcFrame> {
  constructor(private ctrl: CpcFrameSource<Uint8Array>) {}
  init({ endFrame, nextFrame }: CpcController): void {
    const parser = createCpcFrameParser();
    this.ctrl.init({
      endFrame: endFrame,
      nextFrame: function (buf): boolean {
        while (parser.next(buf)) {
          const res = parser.finish();
          const frame = decodeCpcFrame(res.value).frame;
          nextFrame(frame);
          if (res.residue) buf = res.residue;
          else break;
        }
        return false;
      },
    });
  }
  close(): void | Promise<void> {
    if (this.link.length) this.send();
    return this.ctrl.close();
  }
  private link: RpcFrame[] = [];
  dispose(reason?: any): void {
    this.ctrl.dispose?.(reason);
  }
  private send() {
    if (this.link.length) {
      const chunk = packCpcFrames(this.link);
      this.ctrl.sendFrame(chunk);
    }
    this.link.length = 0;
  }
  sendFrame(frame: RpcFrame): void {
    if (this.link.length === 0) Promise.resolve().then(() => this.send());
    this.link.push(frame);
  }
}
