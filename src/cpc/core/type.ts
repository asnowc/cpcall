import type { FrameType } from "./const.ts";
import type { OnceListenable } from "evlib";

export namespace Frame {
  export type Call = { type: FrameType.call; args: any[] };
  export type Exec = { type: FrameType.exec; args: any[] };
  export type ReturnPromise = { type: FrameType.promise; id: number };
  export type Resolve = { type: FrameType.resolve; id: number; value: any };
  export type Reject = { type: FrameType.reject; id: number; value: any };
  export type Return = { type: FrameType.return; value: any };
  export type Throw = { type: FrameType.throw; value: any };
  export type Finish = { type: FrameType.disable };
  export type End = { type: FrameType.end };
  export type ResponseError = { type: FrameType.error; code: number };
}

export type CalleeFrame =
  | Frame.Return
  | Frame.ReturnPromise
  | Frame.Resolve
  | Frame.Reject
  | Frame.Throw
  | Frame.Finish;
export type CallerFrame = Frame.Call | Frame.Exec | Frame.End;
/** @public */
export type RpcFrame = CalleeFrame | CallerFrame | Frame.ResponseError;

/** @public */
export interface CpCaller {
  /** 调用远程设置的函数. 如果 caller ended 不为 0 ，则抛出异常 */
  call(...args: any[]): Promise<any>;
  /** 调用远程设置的函数。与call不同的是，它没有返回值 */
  exec(...args: any[]): void;
  /**
   * 结束远程调用。
   * @returns 当 ended 状态变为 3后解决的 Promise
   * */
  end(): Promise<void>;
  /** caller 状态
   * @remarks
   * 3: 表示已调用 end() 或已收到 disable 帧并且所有等待队列已清空
   * 2: 已收到 disable 帧. 后续不再会收到任何返回帧, 当前非异步返回的等待队列会被全部拒绝 (如果错误的收到了对方的返回帧, 会被丢弃)
   * 1: 已调用 end(). 当前不能再执行 exec() 或 call() 方法
   * 0: 当前可执行远程调用  */
  ended: 0 | 1 | 2 | 3;

  /** ended 变为 2 时触发 */
  readonly disableEvent: OnceListenable<void> & { getPromise(): Promise<void> };
  /** ended 变为 3 时触发 */
  readonly finishEvent: OnceListenable<void> & { getPromise(): Promise<void> };
  /** 销毁 CpCaller*/
  dispose(reason?: any): void;
}
