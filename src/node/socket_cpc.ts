import { CpCall, CpcController, JbodStreamFrameSource, CpCallOption } from "../cpc/mod.ts";

declare function setTimeout(fn: () => void, timeout: number): number;

/** 创建一个基于 duplex 的 CpCall 实例
 * @public
 * @category Rpc
 */
export function createSocketCpc(duplex: Duplex, option?: CpCallOption): CpCall {
  if (!duplex.readable || !duplex.writable) throw createAbortedError();

  const frameSource = new JbodStreamFrameSource({
    init(controller: CpcController<Uint8Array>): void {
      duplex.on("data", (chunk) => {
        controller.nextFrame(chunk);
      });
      duplex.on("end", () => controller.endFrame(new Error("Duplex no more data")));
      duplex.on("error", (e) => controller.endFrame(e));
      duplex.on("close", () => controller.endFrame(new Error("Duplex has bend closed")));
    },
    close() {
      duplex.end();
      setTimeout(() => duplex.destroy(), 16);
      return new Promise((resolve, reject) => {
        duplex.once("close", resolve);
      });
    },
    sendFrame(frame: Uint8Array): void {
      duplex.write(frame);
    },
    dispose(reason?: any): void {
      duplex.destroy(reason);
    },
  });
  return new CpCall(frameSource, option);
}

function createAbortedError() {
  return new Error("Stream has bend aborted");
}
interface Duplex {
  readable?: boolean;
  writable?: boolean;
  on(eventName: string, listener: (...args: any[]) => any): void;
  once(eventName: string, listener: (...args: any[]) => any): void;
  destroy(reason?: any): void;
  end(): void;
  write(data: Uint8Array): void;
}
