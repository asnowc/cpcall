import type { FrameType } from "./const.js";
import type { OnceEventTrigger } from "evlib";

export namespace Frame {
  export type Call = [type: FrameType.call, args: any[]];
  export type Exec = [type: FrameType.exec, args: any[]];
  export type ReturnPromise = [type: FrameType.promise, id: number];
  export type Resolve = [type: FrameType.resolve, id: number, value: any];
  export type Reject = [type: FrameType.reject, id: number, value: any];
  export type Return = [type: FrameType.return, value: any];
  export type Throw = [type: FrameType.throw, value: any];
  export type Finish = [type: FrameType.disable];
  export type End = [type: FrameType.end];
  export type ResponseError = [type: FrameType.error, code: number];
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
  call(...args: any[]): Promise<any>;
  exec(...args: any[]): void;
  /**
   * @remarks 关闭可调用权限
   * @param abort - 如果为true, 这将直接拒绝所有等待返回队列, 并将 ended 置为 3
   * @returns 当 ended 状态变为 3后解决的 Promise
   * */
  end(abort?: boolean): Promise<void>;
  /**
   * @remarks
   * 3: 表示已调用 end() 或已收到 disable 帧并且所有等待队列已清空
   * 2: 已收到 disable 帧. 后续不再会收到任何返回帧, 当前非异步返回的等待队列会被全部拒绝 ( resolve 和 reject 除外. 如果错误的收到了对方的返回帧, 会被丢弃)
   * 1: 已调用 end(). 当前不能再执行 exec() 或 call() 方法
   * 0: 当前可调用  */
  ended: 0 | 1 | 2 | 3;

  /**
   * @remarks ended 变为 2 时触发
   */
  disableEvent: OnceEventTrigger<void>;
  /**
   * @remarks ended 变为 3 时触发
   */
  finishEvent: OnceEventTrigger<void>;
}
