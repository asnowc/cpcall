import { createCpcFrameParser, decodeCpcFrame, packCpcFrames } from "./stream_cpc.ts";
import type { RpcFrame } from "../core/type.ts";
import type { CpcController, CpcFrameSource } from "../cpc/type.ts";

/**
 * 创建基于 JBOD 编解码的 RPC 帧数据源
 * @remarks  它会将 CpCall 在一个宏任务内的生成的帧进行打包
 * @public
 */
export class JbodStreamFrameSource implements CpcFrameSource<RpcFrame> {
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
      this.link.length = 0;
    }
  }
  sendFrame(frame: RpcFrame): void {
    if (this.link.length === 0) Promise.resolve().then(() => this.send());
    this.link.push(frame);
  }
}
