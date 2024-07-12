/**
 * CPC 数据帧类型
 * @public
 * @category Rpc
 */
export enum FrameType {
  call = 1,
  exec = 2,

  error = 7,
  promise = 8,
  resolve = 9,
  reject = 10,

  return = 11,
  throw = 12,

  endCall = 0b1111_1110,
  endServe = 0xff,
}

/**
 * @public
 * @category Rpc
 */
export enum CallerStatus {
  /** 当前可执行远程调用 */
  callable = 0,
  /** 已调用 end(). 当前不能再执行 exec() 或 call() 方法 */
  ending = 1,
  /** 已收到 endServe 帧. 后续不再会收到任何返回帧, 当前非异步返回的等待队列会被全部拒绝 (如果错误的收到了对方的返回帧, 会被丢弃) */
  ended = 2,
  /** 表示已调用 end() 或已收到 endServe 帧并且所有等待队列已清空 */
  finished = 3,
}
/**
 * @public
 * @category Rpc
 */
export enum ServiceStatus {
  /** 服务中 */
  serving = 0,
  /** 已发送 endServe 帧 */
  ended = 1,
  /** 发送 endServe 帧后所有异步返回均响应完成 */
  finished = 2,
}

/** 远程调用抛出异常
 * @public
 * @category Errors
 */
export class RemoteCallError extends Error {
  constructor(message: string, option?: { cause?: any }) {
    //@ts-ignore option 是 es2022 特性
    super(message, option);
  }
  code?: any;
}

/**
 * Cpc 内部错误
 * @public
 * @category Errors
 */
export class CpcError extends Error {}
/**
 * 在返回前断开连接抛出的异常
 * @public
 * @category Errors
 */
export class CpcFailRespondError extends Error {}
/**
 * 已返回 AsyncId (已确认被调用), 但 Promise 结果在返回前断开连接
 * @public
 * @category Errors
 */
export class CpcFailAsyncRespondError extends Error {}
