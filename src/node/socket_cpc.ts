import type { Duplex } from "node:stream";
import { CpCall } from "cpcall";
/** @public */
export function createSocketCpc(duplex: Duplex): CpCall {
  const config = {
    frameIter: duplex,
    sendFrame(frame: Uint8Array) {
      this.frameIter.write(frame);
    },
    dispose() {
      this.frameIter.destroy(new Error("Cpc disposed"));
    },
  };
  const cpcall = CpCall.fromByteIterable(config);
  cpcall.closeEvent.then(() => duplex.end());
  return cpcall;
}
