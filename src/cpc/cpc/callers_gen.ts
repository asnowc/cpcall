class ChainProxyHandler implements ProxyHandler<ProxyFn> {
  constructor(createProxy?: () => ProxyFn) {
    this.#createProxy = createProxy;
  }
  #createProxy?: () => ProxyFn;
  get(target: Fn, p: string | symbol) {
    const value = Reflect.get(target, p);
    if (typeof p !== "string") return value;
    if (value !== undefined) return value;
    // target 取不到值， 返回代理

    return createObjectChain(p, target, this.#createProxy);
  }
  apply(target: ProxyFn, thisArg: any, argArray: any[]) {
    return target(argArray, thisArg, target);
  }
}
type ProxyFn = (argArray: any[], thisArg: any, target: ProxyFn) => any;

/** 获取对象链上的路径 */
export function getChainPath(obj: object): string[] {
  const chain = Reflect.get(obj, CALL_CHAIN);
  let strList: string[] = [];
  if (chain) {
    if (chain.args) strList = [...chain.args];
    else {
      strList = getLinkPath(chain);
      flipArray(strList);
      chain.args = [...strList];
    }
  }
  return strList;
}
/**
 * @param createProxy 构造新的链时调用的函数，这个函数应返回一个新的对象
 */
export function createObjectChain<T extends ProxyFn = ProxyFn>(
  createProxy?: () => T
): CallChian<T>;
/**
 * 基于对象链继续扩展链
 * @param key 扩展的键名
 * @param extend 基于的对象链。如果不存在，key 将为默认键名
 * @param createProxy 构造新的链时调用的函数，这个函数应返回一个新的对象
 */
export function createObjectChain<T extends ProxyFn = ProxyFn>(
  key?: string,
  extend?: object,
  createProxy?: () => T
): CallChian<T>;
export function createObjectChain(
  key_create?: (() => ProxyFn) | string,
  extend?: object,
  createProxy?: () => ProxyFn
): CallChian<ProxyFn> {
  let key: string | undefined;
  if (typeof key_create === "function") createProxy = key_create;
  else key = key_create;

  let chain: Chian | undefined;
  if (key) {
    chain = {
      value: key,
      next: extend && Reflect.get(extend, CALL_CHAIN),
    };
  }

  const target = createProxy ? createProxy() : function () {};
  Reflect.defineProperty(target, CALL_CHAIN, {
    configurable: false,
    writable: false,
    enumerable: false,
    value: chain,
  });
  return new Proxy(target, new ChainProxyHandler(createProxy)) as any;
}
function getLinkPath(node: Chian) {
  const strList = [node.value];
  while (node.next) {
    node = node.next;
    strList.push(node.value);
  }
  return strList;
}
function flipArray(arr: any[]): void {
  let tmp: any;
  let last = arr.length - 1;
  for (let i = 0, max = Math.floor(arr.length / 2); i < max; i++) {
    tmp = arr[i];
    arr[i] = arr[last];
    arr[last] = tmp;
    last--;
  }
}
const CALL_CHAIN = Symbol("call chain");

/** 对象链 */
export type ObjectChian = {
  [key: string | number | symbol]: ObjectChian;
};
/** 可调用的对象链 */
export type CallChian<T extends Fn> = {
  (...args: Parameters<T>): ReturnType<T>;
  [key: string | number | symbol]: CallChian<T>;
};

type Fn = (...args: any[]) => any;

type Chian = {
  next?: Chian;
  value: string;
  args?: readonly string[];
};
