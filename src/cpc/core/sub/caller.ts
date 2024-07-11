import { WithPromise } from "../../../deps/evlib.ts"
import { ReturnQueue } from "./promise_queue.ts";
import {
  FrameType,
  CpcError,
  CpcFailAsyncRespondError,
  CpcFailRespondError,
  RemoteCallError,
  CallerStatus,
} from "../const.ts";
import type { CalleeFrame, RpcFrame } from "../type.ts";
import type { SendCtrl } from "./type.ts";

export class CallerCore {
  constructor(private sendCtrl: SendCtrl) {}
  callerStatus: CallerStatus = CallerStatus.callable;

  get callerFinished() {
    return this.callerStatus === CallerStatus.finished;
  }
  onRemoteServeEnd?: () => void;
  onCallFinish?: () => void;
  abortCall(reason?: any) {
    if (this.callerFinished) return;
    if (!this.checkFinish()) {
      this.#returnQueue.rejectAsyncAll(reason ?? new CpcFailAsyncRespondError());
      this.emitFinish();
    }
  }
  dispose(reason?: any) {
    if (this.callerFinished) return;
    if (this.callerStatus === CallerStatus.callable) {
      this.callerStatus = CallerStatus.ending;
      this.sendCtrl.sendFrame({ type: FrameType.endCall });
    }
    this.abortCall(reason);
  }

  /** 向对方发送 endCall 帧 */
  endCall(): void {
    if (this.callerFinished) return;
    if (this.callerStatus === 0) {
      this.callerStatus = 1;
      this.sendCtrl.sendFrame({ type: FrameType.endCall });
    }
  }
  call(...args: any[]) {
    if (this.callerStatus) return Promise.reject(new Error("Cpc is ended"));
    this.sendCtrl.sendFrame({ type: FrameType.call, args });
    return this.#returnQueue.add({});
  }
  exec(...args: any[]) {
    if (this.callerStatus) return;
    this.sendCtrl.sendFrame({ type: FrameType.exec, args });
  }

  onFrame(frame: RpcFrame): boolean | Error;
  onFrame(frame: CalleeFrame) {
    if (this.callerFinished) return false;
    let err: Error | void;
    switch (frame.type) {
      case FrameType.promise:
        err = this.onCpcReturnPromise(frame.id);
        break;
      case FrameType.reject:
        err = this.onCpcPromiseChange(frame.id, frame.value, true);
        break;
      case FrameType.resolve:
        err = this.onCpcPromiseChange(frame.id, frame.value, false);
        break;
      case FrameType.return:
        err = this.onCpcReturn(frame.value);
        break;
      case FrameType.throw:
        err = this.onCpcReturn(frame.value, true);
        break;
      case FrameType.endServe:
        err = this.onCpcRemoteServeEnd();
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
      hd?.reject(new CpcError("Callee response error Promise frame"));
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
    if (this.callerStatus && this.#returnQueue.size === 0) {
      this.emitFinish();
    }
  }
  private onCpcRemoteServeEnd() {
    this.checkFinish();
  }
  private checkFinish() {
    if (this.callerStatus >= 2) return;
    this.emitCallEnd();
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
        let remoteError = new RemoteCallError(value.message, {
          //@ts-ignore
          cause: value.cause,
        });
        const code = Reflect.get(value, "code");
        if (code !== undefined) remoteError.code = code;
        value = remoteError;
      }
      handle.reject(value);
    } else handle.resolve(value);
  }
  private emitFinish() {
    this.callerStatus = 3;
    this.onCallFinish?.();
  }
  private emitCallEnd() {
    this.callerStatus = 2;
    this.onRemoteServeEnd?.();
  }
}

function createPromiseIdError(id: number, type: "Duplicate" | "Invalid") {
  return new CpcError(`${type} Promise Id '${id}'`);
}
