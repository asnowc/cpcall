import type { FrameType } from "./const.js";

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
