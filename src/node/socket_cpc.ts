import type { Duplex } from "node:stream";
import { CpCall } from "cpcall";
/** @public */
export function createSocketCpc(duplex: Duplex) {
  const cpcall = CpCall.fromByteIterable(duplex, (data) => {
    duplex.write(data);
  });
  cpcall.$close.on(() => duplex.end());
  return cpcall;
}
