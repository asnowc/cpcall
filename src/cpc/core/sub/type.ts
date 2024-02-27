import { RpcFrame } from "../type.js";

export interface SendCtrl<T = RpcFrame> {
  sendFrame(frame: T): void;
}
