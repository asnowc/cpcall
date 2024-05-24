import { OnceEventTrigger, WithPromise } from "evlib";
import { ReturnQueue } from "./promise_queue.ts";
import {
  FrameType,
  CpcError,
  CpcFailAsyncRespondError,
  CpcFailRespondError,
  CalleeError,
  RemoteCallError,
} from "../const.ts";
import type { CalleeFrame, RpcFrame, CpCaller } from "../type.ts";
import type { SendCtrl } from "./type.ts";

/** @internal */
export class CallerCore implements CpCaller {
  constructor(private sendCtrl: SendCtrl) {}
  #end: 0 | 1 | 2 | 3 = 0;
  get ended() {
    return this.#end;
  }
  readonly disableEvent = new OnceEventTrigger<void>();
  forceAbort() {
    if (!this.checkFinish()) {
      this.#returnQueue.rejectAsyncAll(new CpcFailAsyncRespondError());
      this.emitFinish();
    }
  }
  end(abort?: boolean): Promise<void> {
    if (this.#end === 3) return Promise.resolve();
    if (this.#end === 0) {
      this.sendCtrl.sendFrame([FrameType.end]);
      this.#end = 1;
    }
    if (abort) {
      this.forceAbort();
      return Promise.resolve();
    }
    return this.finishEvent.getPromise();
  }

  call(...args: any[]) {
    if (this.#end) return Promise.reject(new Error("Cpc is ended"));
    this.sendCtrl.sendFrame([FrameType.call, args]);
    return this.#returnQueue.add({});
  }
  exec(...args: any[]) {
    if (this.#end) return;
    this.sendCtrl.sendFrame([FrameType.exec, args]);
  }
  get closed() {
    return this.#end === 3;
  }
  readonly finishEvent = new OnceEventTrigger<void>();

  onFrame(frame: RpcFrame): boolean | Error;
  onFrame(frame: CalleeFrame) {
    if (this.closed) return false;
    let err: Error | void;
    switch (frame[0]) {
      case FrameType.promise:
        err = this.onCpcReturnPromise(frame[1]);
        break;
      case FrameType.reject:
        err = this.onCpcPromiseChange(frame[1], frame[2], true);
        break;
      case FrameType.resolve:
        err = this.onCpcPromiseChange(frame[1], frame[2], false);
        break;
      case FrameType.return:
        err = this.onCpcReturn(frame[1]);
        break;
      case FrameType.throw:
        err = this.onCpcReturn(frame[1], true);
        break;
      case FrameType.disable:
        err = this.onCpcDisable();
        break;
      default:
        return false;
    }
    if (err) return err;
    return true;
  }
  private onCpcReturn(arg: any, error?: boolean): Error | void {
    let res = this.#returnQueue.shift();
    if (!res) {
      return new CpcError("Too many response Return frame");
    }
    this.handleAwait(res, arg, error);
  }
  private onCpcReturnPromise(id: number): Error | void {
    if (this.#returnQueue.asyncIdExist(id)) {
      const hd = this.#returnQueue.shift();
      hd?.reject(new CalleeError("Callee response error Promise frame"));
      return createPromiseIdError(id, "Duplicate");
    }
    if (!this.#returnQueue.swapInAsyncMap(id)) {
      return createPromiseIdError(id, "Invalid");
    }
  }
  private onCpcPromiseChange(id: any, arg?: any, error?: boolean): Error | void {
    let res = this.#returnQueue.takeAsyncItem(id);
    if (!res) return new CpcError("Invalid Promise ID");
    this.handleAwait(res, arg, error);
    if (this.#end && this.#returnQueue.size === 0) {
      this.emitFinish();
    }
  }
  private onCpcDisable() {
    this.checkFinish();
  }
  private checkFinish() {
    if (this.#end >= 2) return;
    this.emitDisable();
    this.#returnQueue.rejectSyncAll(new CpcFailRespondError());
    if (this.#returnQueue.asyncMap.size === 0) {
      this.emitFinish();
      return true;
    }
  }
  /** 等待对方返回的 Promise 队列 */
  #returnQueue = new ReturnQueue();
  get waitingNum() {
    return this.#returnQueue.size;
  }
  private handleAwait(handle: WithPromise<any>, value: any, error?: boolean) {
    if (error) {
      if (value instanceof Error) {
        let remoteError = new RemoteCallError(value.message, { cause: value.cause });
        const code = Reflect.get(value, "code");
        if (code !== undefined) remoteError.code = code;
        value = remoteError;
      }
      handle.reject(value);
    } else handle.resolve(value);
  }
  private emitFinish() {
    this.#end = 3;
    this.finishEvent.emit();
  }
  private emitDisable() {
    this.#end = 2;
    this.disableEvent.emit();
  }
}

function createPromiseIdError(id: number, type: "Duplicate" | "Invalid") {
  return new CpcError(`${type} Promise Id '${id}'`);
}
