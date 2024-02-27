import { RpcFrame } from "../type.js";

export interface SendCtrl<T = RpcFrame> {
  sendFrame(frame: T): void;
}
/** @public */
export type CpCallParser<T> = {
  frameIter: AsyncIterable<T>;
  sendFrame(frame: T): void;
  dispose?(): Promise<void> | void;
};
