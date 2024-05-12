/** @public */
export enum FrameType {
  call = 1,
  exec = 2,

  error = 7,
  promise = 8,
  resolve = 9,
  reject = 10,

  return = 11,
  throw = 12,
  end = 0b1111_1110,
  disable = 0xff,
}
/** @public */
export class CalleeError extends Error {}
/** @public */
export class CallerError extends Error {}

/** 远程调用抛出异常
 * @public
 */
export class RemoteCallError extends Error {
  code?: any;
}

/**  @public 内部帧错误 */
export class CpcError extends Error {}
/** 在返回前断开连接
 * @public
 */
export class CpcFailRespondError extends Error {
  constructor() {
    super("CpcFailRespondError");
  }
}
/**  @public 已返回 AsyncId (命令已被执行), 但Promise状态在变化前断开连接*/
export class CpcFailAsyncRespondError extends CpcFailRespondError {}
