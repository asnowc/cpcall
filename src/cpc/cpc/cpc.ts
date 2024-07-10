import { CpCallBase } from "./cpc_base.ts";
import { createObjectChain, getChainPath } from "evlib/object";
import { Registrar } from "./registrar.ts";

/**
 * @public
 */
export class CpCall extends CpCallBase {
  /** 通过 exec 调用远程代理对象
   *
   * @example
   *
   * ```ts
   * const api= cpc.genCaller()
   * CpCall.exec(api.a.b,"arg1","arg2") //这等价与 cpc.exec("api.a.b","arg1","arg2")
   *
   * ```
   */
  static exec<T extends (...args: any[]) => any>(proxyObj: T, ...args: Parameters<T>): void {
    const { cpc, path } = getProxyInfo(proxyObj);
    cpc.exec(path.join(cpc.#separator), ...args);
  }
  /** 通过 call 调用远程代理对象
   *
   * @example
   *
   * ```ts
   * const api= cpc.genCaller()
   * CpCall.call(api.a.b,"arg1","arg2") //这等价于 cpc.call("api.a.b","arg1","arg2")
   *
   * ```
   */
  static call<T extends (...args: any[]) => any>(proxyObj: T, ...args: Parameters<T>): ReturnType<T> {
    const { cpc, path } = getProxyInfo(proxyObj);
    return cpc.call(path.join(cpc.#separator), ...args) as Promise<any> as any;
  }
  protected onCall(rawArgs: any[]) {
    let cmd = rawArgs[0];
    let args = rawArgs.slice(1);
    if (typeof cmd === "string" && cmd) {
      const path = cmd.split(this.#separator);
      const context = this.#registrar.getServe(path);

      if (!context) throw new CpcUnregisteredCommandError(cmd);
      const { fn, meta, this: _this } = context;
      if (meta.transformArgs) args = meta.transformArgs.call(undefined, args);
      let res = fn.apply(_this, args);
      if (meta.transformReturn) {
        if (res instanceof Promise) res = res.then(meta.transformReturn);
        else res = meta.transformReturn.call(undefined, res);
      }
      return res;
    }
    throw new CpcUnregisteredCommandError(cmd);
  }
  readonly #registrar = new Registrar();

  get #separator() {
    return this.#registrar.separator;
  }
  /** 删除已设置的远程可调用对象 */
  removeObject(path?: string | string[]): boolean {
    if (typeof path === "string") path = path.split(this.#separator);
    return this.#registrar.removeServe(path);
  }
  /** 清空所有已设置的远程可调用对象 */
  clearObject() {
    this.#registrar.clear();
  }
  /** 设置远程可调用对象。 */
  setObject(obj: object, path?: string | string[]): void;
  /** 设置远程可调用对象。 */
  setObject(obj: object, option: ParseObjectOption): void;
  setObject(obj: object, path_opts?: string | string[] | ParseObjectOption) {
    let path: string[] | undefined;
    let opts: ParseObjectOption;
    if (typeof path_opts === "string") {
      path = path_opts ? path_opts.split(this.#separator) : undefined;
      opts = {};
    } else if (path_opts instanceof Array) {
      path = path_opts;
    } else if (typeof path_opts === "object") {
      opts = path_opts;
    }
    this.#registrar.setObject(obj, path);
  }

  /** 生成远程代理对象 */
  genCaller(opts?: GenCallerOpts): AnyCaller;
  genCaller(base: string, opts?: GenCallerOpts): AnyCaller;
  genCaller<R extends object>(base: string, opts?: GenCallerOpts): MakeCallers<R, CallerProxyPrototype>;
  genCaller<R extends object>(opts?: GenCallerOpts): MakeCallers<R, CallerProxyPrototype>;
  genCaller(base_opts?: string | GenCallerOpts, opts?: GenCallerOpts): object {
    let base: string;
    if (typeof base_opts === "string") {
      base = base_opts;
      if (!opts) opts = {};
    } else {
      base = "";
      opts = base_opts ?? {};
    }
    const keepThen = opts.keepThen;

    return createObjectChain(base, undefined, () => {
      function src(args: any[], thisArg: any, target: ServeFn) {
        return CpCall.call(target, ...args);
      }
      if (!keepThen) Reflect.set(src, "then", null);
      Reflect.set(src, CPC_SRC, this);
      Reflect.setPrototypeOf(src, callerProxyPrototype);
      return src;
    });
  }
}

type ServeFn = (...args: any[]) => any;

/** 调用未注册的命令
 * @public */
export class CpcUnregisteredCommandError extends Error {
  constructor(cmd: any) {
    super("UnregisteredCommand: " + cmd);
  }
}

/**
 * 自动解析选项
 * @public
 */
export type ParseObjectOption = {
  cmd?: string;
};

/** @public  */
export type GenCallerOpts = {
  /** 默认会添加 then 属性为 null，避免在异步函数中错误执行，如果为 true，则不添加 */
  keepThen?: boolean;
};

function getProxyInfo(proxyObj: (...args: any[]) => any) {
  const cpc = Reflect.get(proxyObj, CPC_SRC);
  if (!(cpc instanceof CpCall)) throw new Error("The target is not a remote cpcall proxy object");
  const path = getChainPath(proxyObj);
  if (path.length === 0) throw new Error("Top-level calls are not allowed");
  return { cpc, path: path };
}

const CPC_SRC = Symbol("cpc src");
const callerProxyPrototype: CallerProxyPrototype = {
  [Symbol.asyncDispose](): Promise<void> {
    return (this as any as CallerProxy)[CPC_SRC].endCall();
  },
};
interface CallerProxy {
  readonly [CPC_SRC]: CpCall;
}

/** @public */
export type CallerProxyPrototype = {
  [Symbol.asyncDispose](): Promise<void>;
};

/** @public */
export type AnyCaller = {
  (...args: any[]): Promise<any>;
  [key: string]: AnyCaller;
};
/** @public */
export type AnyEmitter = {
  (...args: any[]): void;
  [key: string]: AnyCaller;
};
/** @public */
export type MakeCallers<T extends object, E extends object = {}> = E & {
  [Key in keyof T as T[Key] extends object ? Key : never]: T[Key] extends object ? MakeCallers<T[Key], E> : never;
} & (T extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : {});

/** @public */
export type MakeEmitter<T extends object, E extends object = {}> = E & {
  [Key in keyof T as T[Key] extends object ? Key : never]: T[Key] extends object ? MakeCallers<T[Key], E> : never;
} & (T extends (...args: infer A) => any ? (...args: A) => void : {});
