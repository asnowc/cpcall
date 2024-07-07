import { CalleeCore, CallerCore, RpcFrame, ServerStatus, CallerStatus } from "../core/mod.ts";
import { WithPromise, withPromise } from "evlib";

/**
 * 提供最基础的命令调用.
 * @public
 */
export abstract class CpCallBase {
  constructor(private readonly frameSource: CpcFrameSource<RpcFrame>, opts?: CpCallOption) {
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

    callee.onCall = this.onCall.bind(this);

    /* init */

    if (opts) {
      if (!opts.disableCall) caller.abortCall();
      if (!opts.disableServe) callee.abortServe();
    }

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
  protected abstract onCall(rawArgs: any[]): any;
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

/** CpCall 构造函数依赖的接口。你可以实现自定义编解码器，或数据帧转发服务
 * @public
 */
export type CpcFrameSource<T = RpcFrame> = {
  /** 当需要发送数据帧时被调用*/
  sendFrame(frame: T): void;
  /**
   * 初始化时被调用，在构造函数是，它是同步调用的。
   * @param controller - CpCall 实例的控制器
   */
  init(controller: CpcController<T>): void;
  /** 实例正常关闭时调用。它在 closeEvent 触发前被调用，如果返回Promise，则在 Promise 解决后 触发 closeEvent
   * @remarks 如果调用时抛出异常，那么CpCall 的 closeEvent 将触发异常（非正常关闭）
   */
  close(): void | Promise<void>;
  /** 当用户手动调用 dispose() 时或出现异常时调用  */
  dispose(reason?: any): void;
};

/**  CpCall 实例的控制器
 * @public
 */
export type CpcController<T = RpcFrame> = {
  /** 当获取到帧时，应当调用它传给 CpCall 内部 */
  nextFrame(frame: T): void;
  /** 如果不会再有更多帧，应该调用它，CpCall 内部会判断是正常关闭还是异常关闭 */
  endFrame(error?: any): void;
};
/** @public */
export interface CpCallOption {
  disableCall?: boolean;
  disableServe?: boolean;
}
