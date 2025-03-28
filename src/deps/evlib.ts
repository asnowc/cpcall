/* 
这些将被打包进源码
*/

export { UniqueKeyMap } from "./unique_key_map.ts";
export { ByteParser } from "./byte_parser.ts";
export { createObjectChain, getChainPath } from "./call_chain.ts";

export function withPromise<T, R = any, E extends object = {}>(handle?: E): WithPromise<T, R> & E;
export function withPromise(handle: Record<string, any> = {}): WithPromise<unknown, unknown> {
  handle.promise = new Promise(function (resolve, reject) {
    handle.resolve = resolve;
    handle.reject = reject;
  });
  return handle as any;
}
export interface WithPromise<T, R = any> {
  resolve(data: T): void;
  reject(data: R): void;
  promise: Promise<T>;
}
