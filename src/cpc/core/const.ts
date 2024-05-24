/** CPC 数据帧类型
 * @public */
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
export class CalleeError extends Error {}
export class CallerError extends Error {}

/** 远程调用抛出异常
 * @public
 */
export class RemoteCallError extends Error {
  code?: any;
}

/** 内部帧错误 */
export class CpcError extends Error {}
/** 在返回前断开连接
 * @public
 */
export class CpcFailRespondError extends Error {
  constructor() {
    super("CpcFailRespondError");
  }
}
/** 已返回 AsyncId (命令已被执行), 但Promise结果在响应前断开连接
 *  @public */
export class CpcFailAsyncRespondError extends Error {}
