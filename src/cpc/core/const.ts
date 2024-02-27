/** @public */
export enum FrameType {
  call = 1,
  exec = 2,

  error = 7,
  /** @deprecated 改用 FrameType.promise */
  returnAsync = 8,
  promise = 8,
  resolve = 9,
  reject = 10,

  return = 11,
  throw = 12,

  /** @deprecated 改用 FrameType.end */
  fin = 0b1111_1110,
  /** 收到fin后表示对方不会再发起调用 */
  end = 0b1111_1110,
  /** 收到fin后表示对方不会再发起调用 */
  disable = 0xff,
}
/** @public */
export class CalleeError extends Error {}
/** @public */
export class CallerError extends Error {}

/**  @public 内部帧错误 */
export class CpcError extends Error {}
/**
 * @public
 * @remarks 在返回前断开连接
 */
export class CpcFailRespondError extends Error {
  constructor() {
    super("CpcFailRespondError");
  }
}
/**  @public 已返回 AsyncId (命令已被执行), 但Promise状态在变化前断开连接*/
export class CpcFailAsyncRespondError extends CpcFailRespondError {}
