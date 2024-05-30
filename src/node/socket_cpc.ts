import type { Duplex } from "node:stream";
import { CpCall, CpcController } from "cpcall";

/** 创建一个基于 duplex 的 CpCall 实例
 * @public
 */
export function createSocketCpc(duplex: Duplex): CpCall {
  if (!duplex.readable || !duplex.writable) throw createAbortedError();
  return CpCall.fromByteIterable({
    init(controller: CpcController<Uint8Array>): void {
      duplex.on("data", (chunk) => {controller.nextFrame(chunk)});
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
}

function createAbortedError() {
  return new Error("Stream has bend aborted");
}
