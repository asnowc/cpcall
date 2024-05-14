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
    const head: Chian = { value: p, next: Reflect.get(target, CALL_CHAIN) as any };
    return createCallChain(this.#createProxy, head);
  }
  apply(target: ProxyFn, thisArg: any, argArray: any[]) {
    return target(target, argArray, thisArg);
  }
}
type ProxyFn = (target: Fn, argArray: any[], thisArg: any) => any;

export function getChainPath(obj: Fn): string[] {
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
export function createCallChain<T extends Fn, E extends object = {}>(
  createProxy?: () => T,
  chain?: Chian
): CallChianProxy<T, E> {
  const target = createProxy ? createProxy() : function () {};
  Reflect.defineProperty(target, CALL_CHAIN, { configurable: false, writable: false, enumerable: false, value: chain });
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

export type ChianProxy<T extends object, E extends object = {}> = E & {
  [Key in keyof T as T[Key] extends object ? Key : never]: CallChianProxy<T[Key], E>;
};

type Fn = (...args: any[]) => any;
export type CallChianProxy<T, E extends object = {}> = T extends Fn
  ? MakeAsync<T> & ChianProxy<T, E>
  : T extends object
  ? ChianProxy<T, E>
  : never;

type MakeAsync<T> = T extends Fn ? (...args: Parameters<T>) => ToPromise<ReturnType<T>> : never;
type ToPromise<T> = T extends Promise<any> ? T : Promise<T>;

type Chian = {
  next?: Chian;
  value: string;
  args?: readonly string[];
};
