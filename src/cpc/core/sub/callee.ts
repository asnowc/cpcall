import { UniqueKeyMap } from "evlib/data_struct";
import { OnceEventTrigger } from "evlib";
import { FrameType } from "../const.js";
import type { Frame, CallerFrame, RpcFrame } from "../type.js";
import type { SendCtrl } from "./type.js";

/** @internal */
export class CalleeCore {
  constructor(
    protected sendCtrl: SendCtrl,
    public onCall: (...args: any[]) => any = voidFin,
    maxAsyncId: number = 4294967295
  ) {
    this.#sendingUniqueKey = new UniqueKeyMap(maxAsyncId);
  }
  /** 等待返回给对方的 Promise 队列 */
  readonly #sendingUniqueKey: UniqueKeyMap;

  #fin: 0 | 1 | 2 = 0;
  /**
   * 1: 已发送 disable 帧
   * 2: 发送 disable 帧后所有异步返回均响应完成
   * */
  get status() {
    return this.#fin;
  }
  get promiseNum() {
    return this.#sendingUniqueKey.size;
  }
  /** status 变为 2 时触发 */
  readonly finishEvent = new OnceEventTrigger<void>();
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

  /** 结束调用服务，如果当前状态为0， 则发送 disable 帧 */
  disable(): Promise<void> {
    if (this.status === 2) return Promise.resolve();
    let finishing = this.finishEvent.getPromise();
    this.onCpcEnd();
    return finishing;
  }
  forceAbort() {
    this.#fin = 2;
    this.finishEvent.emit();
  }
  private testClose() {
    if (this.promiseNum === 0) {
      this.forceAbort();
      return true;
    }
  }
  private onCpcExec(args: any[]) {
    try {
      const res = this.onCall.apply(undefined, args);
      if (res instanceof Promise) res.catch(voidFin);
    } catch (error) {}
  }
  private onCpcCall(args: any[]) {
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
  private onCpcEnd() {
    if (this.status !== 0) return;
    this.sendCtrl.sendFrame([FrameType.disable] as Frame.Finish);
    this.#fin = 1;
    return this.testClose();
  }

  private handelReturnPromise(pms: Promise<any>) {
    const id = this.#sendingUniqueKey.allowKeySet(pms);
    this.sendCtrl.sendFrame([FrameType.promise, id]);
    return pms
      .then(
        (value) => [FrameType.resolve, id, value] as Frame.Resolve,
        (err) => [FrameType.reject, id, err] as Frame.Reject
      )
      .then((frame) => {
        this.#sendingUniqueKey.delete(id);
        if (this.status === 2) return;
        this.sendCtrl.sendFrame(frame);
        if (this.status === 1) this.testClose();
      });
  }
}

function voidFin() {}
