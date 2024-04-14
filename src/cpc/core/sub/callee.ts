import { UniqueKeyMap } from "evlib/data_struct";
import { OnceEventTrigger } from "evlib";
import { FrameType } from "../const.js";
import type { Frame, CallerFrame, RpcFrame } from "../type.js";
import type { SendCtrl } from "./type.js";

/** @internal */
export abstract class CalleeCommon {
  constructor(maxAsyncId = 4294967295) {
    this.#sendingUniqueKey = new UniqueKeyMap(maxAsyncId);
  }
  /** 等待返回给对方的 Promise 队列 */
  readonly #sendingUniqueKey: UniqueKeyMap;
  get promiseNum() {
    return this.#sendingUniqueKey.size;
  }
  /**
   * 1: 已发送 disable 帧
   * 2: 发送 disable 帧后所有异步返回均响应完成
   * */
  abstract readonly status: 0 | 1 | 2;

  /**
   * @throws 收到帧后必定会响应帧，这会调用 sendFrame. 如果 sendFrame 发生异常，则会抛出
   */
  onFrame(frame: RpcFrame): boolean;
  onFrame(chunk: CallerFrame) {
    switch (chunk[0]) {
      case FrameType.call:
        if (this.status > 0) return true; // 丢弃
        this.onCpcCall(chunk[1]);
        break;
      case FrameType.exec:
        if (this.status > 0) return true; // 丢弃
        this.onCpcExec(chunk[1]);
        break;
      case FrameType.end:
        if (this.status > 0) return true; // 丢弃
        this.onCpcEnd();
        break;
      default:
        return false;
    }
    return true;
  }
  protected abstract sendCtrl: SendCtrl;
  protected abstract testClose(): void;
  protected abstract onCpcCall(args: any[]): void;
  protected abstract onCpcExec(args: any[]): void;
  protected abstract onCpcEnd(): void;

  protected handelReturnPromise(pms: Promise<any>) {
    const id = this.#sendingUniqueKey.allowKeySet(pms);
    this.sendCtrl.sendFrame([FrameType.promise, id]);
    return pms
      .then(
        (value) => [FrameType.resolve, id, value] as Frame.Resolve,
        (err) => [FrameType.reject, id, err] as Frame.Reject
      )
      .then((frame) => {
        this.#sendingUniqueKey.delete.bind(this, id);
        if (this.status === 2) return;
        this.sendCtrl.sendFrame(frame);
        if (this.status === 1) this.testClose();
      });
  }
}

/** @internal */
export class CalleePassive extends CalleeCommon {
  constructor(protected sendCtrl: SendCtrl, public onCall: (...args: any[]) => any = voidFin, maxAsyncId?: number) {
    super(maxAsyncId);
  }

  #fin: 0 | 1 | 2 = 0;
  get status() {
    return this.#fin;
  }

  /** @remarks status 变为 2 时触发 */
  readonly finishEvent = new OnceEventTrigger<void>();

  /** 结束调用服务，如果当前状态为0， 则发送 disable 帧 */
  disable(abort?: boolean): Promise<void> {
    if (this.status === 2) return Promise.resolve();
    let finishing = this.finishEvent.getPromise();
    const emitClose = this.onCpcEnd();
    if (abort && !emitClose) this.forceAbort();
    return finishing;
  }
  forceAbort() {
    this.#fin = 2;
    this.finishEvent.emit();
  }
  protected testClose() {
    if (this.promiseNum === 0) {
      this.forceAbort();
      return true;
    }
  }
  protected onCpcExec(args: any[]) {
    try {
      const res = this.onCall.apply(undefined, args);
      if (res instanceof Promise) res.catch(voidFin);
    } catch (error) {}
  }
  protected onCpcCall(args: any[]) {
    let res;
    try {
      res = this.onCall.apply(undefined, args);
    } catch (error) {
      this.sendCtrl.sendFrame([FrameType.throw, error] as Frame.Throw);
      return;
    }
    if (res instanceof Promise) this.handelReturnPromise(res);
    else this.sendCtrl.sendFrame([FrameType.return, res] as Frame.Return);
  }
  protected onCpcEnd() {
    if (this.status !== 0) return;
    this.sendCtrl.sendFrame([FrameType.disable] as Frame.Finish);
    this.#fin = 1;
    return this.testClose();
  }
}

function voidFin() {}
