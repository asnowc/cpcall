import type { FrameType } from "./const.ts";

/** @public */
export namespace Frame {
  export type Call = { type: FrameType.call; args: any[] };
  export type Exec = { type: FrameType.exec; args: any[] };
  export type ReturnPromise = { type: FrameType.promise; id: number };
  export type Resolve = { type: FrameType.resolve; id: number; value: any };
  export type Reject = { type: FrameType.reject; id: number; value: any };
  export type Return = { type: FrameType.return; value: any };
  export type Throw = { type: FrameType.throw; value: any };
  export type EndServe = { type: FrameType.endServe };
  export type EndCall = { type: FrameType.endCall };
  export type ResponseError = { type: FrameType.error; code: number };
}

/** @public */
export type CalleeFrame =
  | Frame.Return
  | Frame.ReturnPromise
  | Frame.Resolve
  | Frame.Reject
  | Frame.Throw
  | Frame.EndServe;

/** @public */
export type CallerFrame = Frame.Call | Frame.Exec | Frame.EndCall;

/** @public */
export type RpcFrame =
  | Frame.Return
  | Frame.ReturnPromise
  | Frame.Resolve
  | Frame.Reject
  | Frame.Throw
  | Frame.EndServe
  | Frame.Call
  | Frame.Exec
  | Frame.EndCall
  | Frame.ResponseError;

/** @public */
export interface ServeFnTransform<A extends any[], R> {
  /** 参数转换 */
  transformArgs?(args: any[]): A;
  /** 返回值转换 */
  transformReturn?(data: R): any;
}
/** @public */
export interface SetServeFnOption {
  /** 函数执行上下文 */
  this?: object;
}
