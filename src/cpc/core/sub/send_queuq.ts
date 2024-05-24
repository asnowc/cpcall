import { RpcFrame } from "../type.ts";

class SendingQueue {
  queue: RpcFrame[] = [];
  constructor(senFrame: (frame: RpcFrame[]) => Promise<void>) {}
  push(frame: RpcFrame) {
    this.queue.push(frame);
  }
}
