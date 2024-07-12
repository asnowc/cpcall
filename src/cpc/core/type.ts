import type { FrameType } from "./const.ts";

/**
 * @public
 * @category Rpc
 */
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

/**
 * @public
 * @category Rpc
 */
export type CalleeFrame =
  | Frame.Return
  | Frame.ReturnPromise
  | Frame.Resolve
  | Frame.Reject
  | Frame.Throw
  | Frame.EndServe;

/**
 * @public
 * @category Rpc
 */
export type CallerFrame = Frame.Call | Frame.Exec | Frame.EndCall;

/**
 * CpCall 的数据帧
 * @public
 * @category Rpc
 */
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
