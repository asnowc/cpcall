import { UniqueKeyMap } from "../../../deps/evlib.ts";
import { FrameType, ServerStatus } from "../const.ts";
import type { Frame, CallerFrame, RpcFrame } from "../type.ts";
import type { SendCtrl } from "./type.ts";

export class CalleeCore {
  constructor(protected sendCtrl: SendCtrl, maxAsyncId: number = 4294967295) {
    this.#sendingUniqueKey = new UniqueKeyMap(maxAsyncId);
  }
  /** 等待返回给对方的 Promise 队列 */
  readonly #sendingUniqueKey: UniqueKeyMap;

  serverStatus: ServerStatus = ServerStatus.serving;

  get promiseNum() {
    return this.#sendingUniqueKey.size;
  }
  onCall: (args: any[]) => any = voidFin;
  onServeEnd?: () => void;
  onServeFinish?: () => void;
  /**
   * @throws 收到帧后必定会响应帧，这会调用 sendFrame. 如果 sendFrame 发生异常，则会抛出
   */
  nextFrame(frame: RpcFrame): boolean;
  nextFrame(chunk: CallerFrame) {
    switch (chunk.type) {
      case FrameType.call:
        if (this.serverStatus > 0) return true; // 丢弃
        this.onCpcCall(chunk.args);
        break;
      case FrameType.exec:
        if (this.serverStatus > 0) return true; // 丢弃
        this.onCpcExec(chunk.args);
        break;
      case FrameType.endCall:
        if (this.serverStatus > 0) return true; // 丢弃
        this.onCpcRemoteCallEnd();
        break;
      default:
        return false;
    }
    return true;
  }
  /** 向对方发送 endServe 帧 */
  endServe(): void {
    if (this.serverStatus === ServerStatus.finished) return;
    this.onCpcRemoteCallEnd();
  }
  abortServe() {
    this.serverStatus = ServerStatus.finished;
    this.onServeFinish?.();
  }
  dispose() {
    if (this.serverStatus === ServerStatus.serving) {
      this.onCpcRemoteCallEnd();
    }
    this.abortServe();
  }
  private testClose() {
    if (this.promiseNum === 0) {
      this.abortServe();
      return true;
    }
  }
  private onCpcExec(args: any[]) {
    try {
      const res = this.onCall(args);
      if (res instanceof Promise) res.catch(voidFin);
    } catch (error) {}
  }
  private onCpcCall(args: any[]) {
    let res;
    try {
      res = this.onCall(args);
    } catch (error) {
      this.sendCtrl.sendFrame({ type: FrameType.throw, value: error } satisfies Frame.Throw);
      return;
    }
    if (res instanceof Promise) this.handelReturnPromise(res);
    else this.sendCtrl.sendFrame({ type: FrameType.return, value: res } satisfies Frame.Return);
  }
  private onCpcRemoteCallEnd() {
    if (this.serverStatus !== 0) return;
    this.sendCtrl.sendFrame({ type: FrameType.endServe } satisfies Frame.EndServe);
    this.serverStatus = 1;
    this.onServeEnd?.();
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
        if (this.serverStatus === 2) return;
        this.sendCtrl.sendFrame(frame);
        if (this.serverStatus === 1) this.testClose();
      });
  }
}

function voidFin() {}
