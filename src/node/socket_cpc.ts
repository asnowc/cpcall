import type { Duplex } from "node:stream";
import { CpCall } from "cpcall";
/** @public */
export function createSocketCpc(duplex: Duplex): CpCall {
  const cpcall = CpCall.fromByteIterable(
    duplex,
    (data) => duplex.write(data),
    () => duplex.destroy(new Error("Cpc disposed"))
  );
  cpcall.$close.on(() => duplex.end());
  return cpcall;
}
