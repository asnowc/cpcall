import { CalleeCore, CallerCore, RpcFrame, ServerStatus, CallerStatus } from "../core/mod.ts";
import { WithPromise, withPromise } from "evlib";
import { CpcFrameSource } from "./type.ts";

/**
 * 提供最基础的命令调用.
 * @public
 */
export abstract class CpCallBase {
  constructor(private readonly frameSource: CpcFrameSource<RpcFrame>, config: CpCallBaseOption) {
    /* caller */

    const caller = new CallerCore(frameSource);
    this.#caller = caller;

    const onCallEndHandle = withPromise<void>();
    this.onCallEnd = onCallEndHandle.promise;
    this.#resolveCallEnd = onCallEndHandle.resolve;
    caller.onRemoteServeEnd = onCallEndHandle.resolve;

    this.#onCallFinish = withPromise<void>();
    caller.onCallFinish = () => {
      this.#onCallFinish.resolve();
      this.#onClose();
    };

    /* callee */

    const callee = new CalleeCore(frameSource);
    this.#callee = callee;

    const onServeEndHandle = withPromise<void>();
    this.onServeEnd = onServeEndHandle.promise;
    this.#resolveCallEnd = callee.onServeEnd = onServeEndHandle.resolve;

    this.#onServeFinish = withPromise<void>();
    callee.onServeFinish = () => {
      this.#onServeFinish.resolve();
      this.#onClose();
    };

    callee.onCall = config.onCall;

    /* init */

    if (config.disableCall) caller.abortCall();
    if (config.disableServe) callee.abortServe();

    frameSource.init({
      endFrame: (reason) => {
        if (this.closed) return;
        this.dispose(reason ?? new Error("异常结束"));
      },
      nextFrame: (frame: RpcFrame) => {
        this.#callee.nextFrame(frame) || this.#caller.onFrame(frame);
      },
    });
  }

  /* --------- caller ------------- */

  /** 调用远程设置的函数. 如果 caller ended 不为 0 ，则抛出异常 */
  call(...args: any[]): Promise<any> {
    return this.#caller.call(...args);
  }
  /** 调用远程设置的函数。与 call 不同的是，它没有返回值 */
  exec(...args: any[]): void {
    this.#caller.exec(...args);
  }
  /**
   * 结束远程调用。调用后，不饿能再调用 call() 和 exec()
   * @remarks 为保证连接能正常关闭，当不再需要远程调用服务时。应手动调用它
   * @returns 当 ended 状态变为 3 后解决的 Promise
   * */
  endCall(): Promise<void> {
    this.#resolveCallEnd();
    this.#caller.endCall();
    return this.#onCallFinish.promise;
  }
  readonly #onCallFinish: WithPromise<void>;
  /** caller 状态   */
  get callerStatus(): CallerStatus {
    return this.#caller.callerStatus;
  }

  readonly #resolveCallEnd: () => void;
  /** ended 变为 2 时触发 */
  readonly onCallEnd: Promise<void>;

  /* --------- callee ------------- */

  /** 当 结束服务时触发 (status 变为 1 时触发) 。这可以由 endServer() 触发，也可以是远程的 endCall() 触发 */
  readonly onServeEnd: Promise<void>;
  /** 服务状态 */
  get serverStatus(): ServerStatus {
    return this.#callee.serverStatus;
  }
  protected get responsePromiseNum(): number {
    return this.#callee.promiseNum;
  }
  /**
   * 结束调用服务。调用后，对方如果继续发起远程调用，将会响应给对方异常。
   * @remarks 为保证连接能正常关闭，当不再提供调用服务时，应手动调用。
   * @returns 返回当 serverStatus 变为 2 时解决的 Promise
   */
  endServe(): Promise<void> {
    this.#callee.endServe();
    return this.#onServeFinish.promise;
  }
  readonly #onServeFinish: WithPromise<void>;

  /* --------- close ------------- */

  #errored: any;
  readonly #closeEvent = withPromise<void>();
  /**
   * 关闭事件
   * @remarks
   * 这分为正常关闭和异常关闭，如果你需要监听无论正常异常都触发的事件，你应调用 `onClose.finally()` 监听
   *
   */
  readonly onClose: Promise<void> = this.#closeEvent.promise;
  /** 销毁连接
   * @returns 返回 CpCall 完全关闭后解决的 Promise
   */
  dispose(reason: any = null): void {
    if (this.#errored !== undefined) return; //已经销毁过或已关闭
    this.#errored = reason;
    this.#callee.abortServe();
    this.#caller.abortCall(reason);
    if (this.frameSource.dispose) {
      try {
        this.frameSource.dispose(reason);
      } catch (error) {}
    }
    this.#closeEvent.reject(reason);
  }
  /** 关闭 CpCall, 相当于同时调用 endServe() 和 endCall()*/
  async close(): Promise<void> {
    await Promise.all([this.#callee.endServe(), this.#caller.endCall()]);
  }
  async #onClose() {
    if (this.#errored !== undefined) return; //已经发生异常或已关闭
    if (!this.closed) return;
    try {
      await this.frameSource.close();
      this.#errored = null;
      this.#closeEvent.resolve();
    } catch (error) {
      this.dispose(error);
      return;
    }
  }
  get closed(): boolean {
    return this.#callee.serverStatus === 2 && this.#caller.callerFinished;
  }
  readonly #callee: CalleeCore;
  readonly #caller: CallerCore;
}

/** @public */
export interface CpCallBaseOption {
  disableCall?: boolean;
  disableServe?: boolean;
  onCall(args: unknown[]): any;
}
