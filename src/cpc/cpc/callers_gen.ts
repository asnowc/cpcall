import type { CpCaller } from "../type.js";
class CallerGenHandler<T extends object> implements ProxyHandler<T> {
  constructor(
    private caller: CpCaller,
    private prefix: string,
    private sp: string,
    private excludeProperty: Set<string> = new Set()
  ) {}
  get(target: T, p: string | symbol) {
    if (typeof p !== "string" || this.excludeProperty?.has(p)) return (target as any)[p];
    return createCallerGen(this.caller, this.prefix ? this.prefix + this.sp + p : p, this.sp);
  }
  set(target: any, p: string | symbol, value: any) {
    if (typeof p === "string") this.excludeProperty.add(p);
    target[p] = value;
    return true;
  }
  ownKeys(target: T): ArrayLike<string | symbol> {
    const keys: (string | symbol)[] = Object.getOwnPropertySymbols(target);
    for (const key of this.excludeProperty) keys.push(key);
    return keys;
  }
  defineProperty(target: T, p: string | symbol, attributes: PropertyDescriptor): boolean {
    if (typeof p === "string") this.excludeProperty.add(p);
    Object.defineProperty(target, p, attributes);
    return true;
  }
  deleteProperty(target: T, p: string | symbol): boolean {
    if (this.excludeProperty.has(p as any)) this.excludeProperty.delete(p as any);
    return Reflect.deleteProperty(target, p);
  }
  apply(target: T, thisArg: any, argArray: any[]) {
    if (!this.prefix) throw new Error("Top-level calls are not allowed");
    return this.caller.call(this.prefix, ...argArray);
  }
}
export function createCallerGen<T extends object>(
  caller: CpCaller,
  prefix: string,
  sp: string,
  excludeProperty?: Set<string>
): ToAsync<T> {
  return new Proxy(() => {}, new CallerGenHandler(caller, prefix, sp, excludeProperty)) as any;
}

export type ToAsync<T extends object> = {
  [Key in keyof T as T[Key] extends object ? Key : never]: MakeCallers<T[Key]>;
};

type Fn = (...args: any[]) => any;
/** @public */
export type MakeCallers<T> = T extends Fn ? MakeAsync<T> & ToAsync<T> : T extends object ? ToAsync<T> : never;

type MakeAsync<T> = T extends Fn ? (...args: Parameters<T>) => ToPromise<ReturnType<T>> : never;
type ToPromise<T> = T extends Promise<any> ? T : Promise<T>;
