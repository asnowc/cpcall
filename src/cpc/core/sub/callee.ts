import { UniqueKeyMap } from "evlib/data_struct";
import { OnceEventTrigger } from "evlib";
import { FrameType } from "../const.ts";
import type { Frame, CallerFrame, RpcFrame } from "../type.ts";
import type { SendCtrl } from "./type.ts";

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
   * 0: 服务中
   * 1: 已发送 endServe 帧
   * 2: 发送 endServe 帧后所有异步返回均响应完成
   * */
  get status() {
    return this.#fin;
  }
  get promiseNum() {
    return this.#sendingUniqueKey.size;
  }
  /** 可能有 endServer() 触发，也可能是 远程的 endCall() 触发 */
  readonly onServeEnd = new OnceEventTrigger<void>();
  /** 发送 endServe 帧后所有异步返回均响应完成 (status 变为 2 时触发) */
  readonly onServeFinish = new OnceEventTrigger<void>();
  /**
   * @throws 收到帧后必定会响应帧，这会调用 sendFrame. 如果 sendFrame 发生异常，则会抛出
   */
  onFrame(frame: RpcFrame): boolean;
  onFrame(chunk: CallerFrame) {
    switch (chunk.type) {
      case FrameType.call:
        if (this.status > 0) return true; // 丢弃
        this.onCpcCall(chunk.args);
        break;
      case FrameType.exec:
        if (this.status > 0) return true; // 丢弃
        this.onCpcExec(chunk.args);
        break;
      case FrameType.endCall:
        if (this.status > 0) return true; // 丢弃
        this.onCpcRemoteCallEnd();
        break;
      default:
        return false;
    }
    return true;
  }

  /** 结束调用服务，如果当前状态为 0， 则发送 endServe 帧 */
  endServe(): Promise<void> {
    if (this.status === 2) return Promise.resolve();
    let finishing = this.onServeFinish.getPromise();
    this.onCpcRemoteCallEnd();
    return finishing;
  }
  abortServe() {
    this.#fin = 2;
    this.onServeFinish.emit();
  }
  private testClose() {
    if (this.promiseNum === 0) {
      this.abortServe();
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
      this.sendCtrl.sendFrame({ type: FrameType.throw, value: error } satisfies Frame.Throw);
      return;
    }
    if (res instanceof Promise) this.handelReturnPromise(res);
    else this.sendCtrl.sendFrame({ type: FrameType.return, value: res } satisfies Frame.Return);
  }
  private onCpcRemoteCallEnd() {
    if (this.status !== 0) return;
    this.sendCtrl.sendFrame({ type: FrameType.endServe } satisfies Frame.EndServe);
    this.#fin = 1;
    return this.testClose();
  }

  private handelReturnPromise(pms: Promise<any>) {
    const id = this.#sendingUniqueKey.allowKeySet(pms);
    this.sendCtrl.sendFrame({ type: FrameType.promise, id });
    return pms
      .then(
        (value) => ({ type: FrameType.resolve, id, value } satisfies Frame.Resolve),
        (err) => ({ type: FrameType.reject, id, value: err } satisfies Frame.Reject)
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
