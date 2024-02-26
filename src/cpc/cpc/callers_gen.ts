class CallerGenHandler<T extends Fn> implements ProxyHandler<T> {
  constructor(
    private createOrigin: (args: any) => { fn: Fn; excludeKeys?: Set<string> },
    private args: any,
    private prefix: string,
    private sp: string,
    private excludeKeys: Set<string> = new Set()
  ) {}
  get(target: T, p: string | symbol) {
    if (typeof p !== "string" || this.excludeKeys?.has(p)) return (target as any)[p];
    return createCallerGen(this.createOrigin, this.args, this.prefix ? this.prefix + this.sp + p : p, this.sp);
  }
  set(target: any, p: string | symbol, value: any) {
    target[p] = value;
    if (typeof p === "string") this.excludeKeys.add(p);
    return true;
  }
  has(target: T, p: string | symbol): boolean {
    if (typeof p === "symbol") return Object.hasOwn(target, p);
    else return this.excludeKeys.has(p);
  }
  defineProperty(target: T, p: string | symbol, attributes: PropertyDescriptor): boolean {
    Object.defineProperty(target, p, attributes);
    if (typeof p === "string") this.excludeKeys.add(p);
    return true;
  }
  deleteProperty(target: T, p: string | symbol): boolean {
    let del = Reflect.deleteProperty(target, p);
    if (del && this.excludeKeys.has(p as any)) this.excludeKeys.delete(p as any);
    return del;
  }
  apply(target: T, thisArg: any, argArray: any[]) {
    if (!this.prefix) throw new Error("Top-level calls are not allowed");
    return target.call(target, this.prefix, ...argArray);
  }
}
export function createCallerGen<T extends object, E extends object = {}, R = void>(
  createOrigin: (arg: R) => { fn: Fn; excludeKeys?: Set<string> },
  arg: R,
  prefix: string,
  sp: string
): ToAsync<T, E> {
  const { fn: real, excludeKeys } = createOrigin(arg);
  return new Proxy(real, new CallerGenHandler(createOrigin, arg, prefix, sp, excludeKeys)) as any;
}

export type ToAsync<T extends object, E = {}> = E & {
  [Key in keyof T as T[Key] extends object ? Key : never]: MakeCallers<T[Key], E>;
};

type Fn = (...args: any[]) => any;
/** @public */
export type MakeCallers<T, E = {}> = T extends Fn
  ? MakeAsync<T> & ToAsync<T, E>
  : T extends object
  ? ToAsync<T, E>
  : never;

type MakeAsync<T> = T extends Fn ? (...args: Parameters<T>) => ToPromise<ReturnType<T>> : never;
type ToPromise<T> = T extends Promise<any> ? T : Promise<T>;
