import type { CpCaller } from "../type.js";
class CallerGenHandler<T extends object> implements ProxyHandler<T> {
  constructor(private caller: CpCaller, private prefix: string, private sp: string) {}
  get(target: T, p: string | symbol) {
    if (typeof p !== "string") return (target as any)[p];
    return createCallerGen(this.caller, this.prefix ? this.prefix + this.sp + p : p, this.sp);
  }
  set(target: T, p: string | symbol) {
    return false;
  }
  apply(target: T, thisArg: any, argArray: any[]) {
    if (!this.prefix) throw new Error("Top-level calls are not allowed");
    return this.caller.call(this.prefix, ...argArray);
  }
}

export function createCallerGen<T extends object>(caller: CpCaller, prefix: string, sp: string): ToAsync<T> {
  return new Proxy(() => {}, new CallerGenHandler(caller, prefix, sp)) as any;
}

export type ToAsync<T extends object> = {
  [Key in keyof T as T[Key] extends object ? Key : never]: MakeCallers<T[Key]>;
};

type Fn = (...args: any[]) => any;
/** @public */
export type MakeCallers<T> = T extends Fn ? MakeAsync<T> & ToAsync<T> : T extends object ? ToAsync<T> : never;

type MakeAsync<T> = T extends Fn ? (...args: Parameters<T>) => ToPromise<ReturnType<T>> : never;
type ToPromise<T> = T extends Promise<any> ? T : Promise<T>;
