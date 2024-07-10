import { CpCallBase, AnyCaller, AnyEmitter, MakeCallers } from "cpcall";
declare class CpcGroup {
  constructor() {}
  join(cpc: CpCallBase): void;
  leave(cpc: CpCallBase): void;
  emit(...args: any[]): void;
  getEmitter(): AnyEmitter;
}
let c = new CpcGroup();
c.getEmitter().dkg.dg();
