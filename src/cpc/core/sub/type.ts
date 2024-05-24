import { RpcFrame } from "../type.ts";

export interface SendCtrl<T = RpcFrame> {
  sendFrame(frame: T): void;
}
