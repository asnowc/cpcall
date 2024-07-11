import { ServiceDefineMode, SymbolMetadata, getOrCreateRpcDecorateMeta } from "./registrar.ts";

/**
 * @param mode - 定义模式
 * RpcDefineMode.include: 默认值。必须显示标注暴露的函数
 *
 * RpcDefineMode.exclude: 默认暴露对象的所有方法
 *
 * @public
 */
export function RpcService(
  mode?: ServiceDefineMode
): (input: new (...args: any[]) => Object, context: ClassDecoratorContext) => void {
  return (input, context) => {
    const rpcDefineConfigMeta = getOrCreateRpcDecorateMeta(context.metadata!);
    rpcDefineConfigMeta.mode = mode;
  };
}
/**
 * @public
 */
export function RpcExposed(): RpcDecorator {
  return function rpcFnDecorate(input, context) {
    if (typeof context.name !== "string") throw new RpcDecorateError();
    const serviceConfig = getOrCreateRpcDecorateMeta(context.metadata);
    serviceConfig.includes.set(context.name, {});
  };
}
/** @public */
export const rpcExclude: RpcDecorator = function rpcExclude(input, context) {
  if (typeof context.name !== "string") throw new RpcDecorateError();
  const serviceConfig = getOrCreateRpcDecorateMeta(context.metadata);
  if (!serviceConfig.excludes) serviceConfig.excludes = new Set();
  serviceConfig.excludes.add(context.name);
};

/**
 * 调用拦截器
 * @public
 */
export function RpcInterceptCall<T extends any[], A extends any[]>(interceptor: (args: T) => A): RpcDecorator<A> {
  if (typeof interceptor !== "function") throw new Error("interceptor must be a function");
  return function rpcFnDecorate(input, context) {
    if (typeof context.name !== "string") throw new RpcDecorateError();
    const meta = getOrCreateRpcDecorateMeta(context.metadata!);
    const config = meta.includes.get(context.name);
    if (!config) throw new Error(`The attribute "${context.name}" is not marked as an rpc attribute`);
    config.interceptCall = interceptor;
  };
}
/**
 * 返回拦截器
 * @public
 */
export function RpcInterceptReturn<T, R>(interceptor?: (result: R) => T): RpcDecorator<any[], R> {
  if (typeof interceptor !== "function") throw new Error("interceptor must be a function");
  return function rpcFnDecorate(input, context) {
    if (typeof context.name !== "string") throw new RpcDecorateError();
    const meta = getOrCreateRpcDecorateMeta(context.metadata!);
    const config = meta.includes.get(context.name);
    if (!config) throw new Error(`The attribute "${context.name}" is not marked as an rpc attribute`);
    config.interceptReturn = interceptor;
  };
}

/**
 * 不支持装饰器的情况可以通过该函数手动标注服务类
 * @public
 */
export function manualDefineObject(
  Class: new (...args: any[]) => any,
  serviceDecorator: RpcDecorator,
  define?: Record<string, RpcDecorator[]>
) {
  if (typeof Class !== "function") throw new Error("Class must be a function");
  let metadata = Reflect.get(Class, SymbolMetadata);
  if (!metadata) {
    metadata = {};
    Reflect.set(Class, SymbolMetadata, metadata);
  }
  serviceDecorator(undefined, { name: Class.name, metadata });
  if (define) {
    for (const key of Object.keys(define)) {
      for (const decorator of define[key]) {
        decorator(undefined, { name: key, metadata });
      }
    }
  }
}

class RpcDecorateError extends Error {
  constructor() {
    super("Only string properties are supported");
  }
}
/** @public */
export type RpcDecorator<A extends any[] = any[], R = any> = (
  input: unknown,
  context: { name: string | symbol; metadata: object }
) => void;
