import { CpCallBase } from "./cpc_base.ts";
import { createObjectChain, getChainPath } from "evlib/object";
import { getServe, ServeObjectRoot } from "./registrar.ts";
import { CpcFrameSource } from "./type.ts";
import { RpcFrame } from "../core/type.ts";

export { ServiceDefineMode } from "./registrar.ts";
export * from "./decorate.ts";
/**
 * @public
 */
export class CpCall extends CpCallBase {
  constructor(frameSource: CpcFrameSource<RpcFrame>, config?: CpCallOption) {
    super(frameSource, {
      ...config,
      onCall: (args) => {
        return this.#onCall(args);
      },
    });
    if (config) {
      if (config.serveObject) {
        this.setObject(config.serveObject);
      }
    }
  }
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
  #onCall(rawArgs: any[]) {
    let cmd = rawArgs[0];
    let args = rawArgs.slice(1);
    if (typeof cmd === "string" && cmd) {
      const path = cmd.split(this.#separator);

      const context = getServe(this.#root, path);

      if (!context) throw new UnregisteredMethodError(cmd);
      const { fn, meta, this: _this } = context;
      if (meta.interceptCall) args = meta.interceptCall.call(undefined, args);
      let res = Reflect.apply(fn, _this, args);
      if (meta.interceptReturn) {
        if (res instanceof Promise) res = res.then(meta.interceptReturn);
        else res = meta.interceptReturn.call(undefined, res);
      }
      return res;
    }
    throw new UnregisteredMethodError(cmd);
  }

  /** 删除设置的可调用服务 */
  setObject(obj?: object): void;
  /** 设置可调用的服务 */
  setObject(obj: object): void;
  setObject(obj: object = {}, option?: ParseObjectOption) {
    if (typeof obj !== "object" || obj === null) throw new Error("obj must be an object");
    this.#root = { object: obj };
  }

  #separator = ".";
  #root: ServeObjectRoot = { object: {} };

  /** 生成远程代理对象 */
  genCaller(opts?: GenCallerOpts): AnyCaller;
  genCaller(base: string, opts?: GenCallerOpts): AnyCaller;
  genCaller<R extends object>(base: string, opts?: GenCallerOpts): MakeCallers<R>;
  genCaller<R extends object>(opts?: GenCallerOpts): MakeCallers<R>;
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
      function src(args: any[], thisArg: any, target: (...args: any[]) => any) {
        return CpCall.call(target, ...args);
      }
      if (!keepThen) Reflect.set(src, "then", null);
      Reflect.set(src, CPC_SRC, this);
      Reflect.setPrototypeOf(src, callerProxyPrototype);
      return src;
    });
  }
}

/** 调用未注册的命令
 * @public */
export class UnregisteredMethodError extends Error {
  constructor(cmd: any) {
    super("UnregisteredMethod: " + cmd);
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
  // [Symbol.asyncDispose](): Promise<void> {
  //   return (this as any as CallerProxy)[CPC_SRC].endCall();
  // },
};
interface CallerProxy {
  readonly [CPC_SRC]: CpCall;
}

type CallerProxyPrototype = {
  // [Symbol.asyncDispose](): Promise<void>;
};
/** @public */
export interface CpCallOption {
  disableCall?: boolean;
  disableServe?: boolean;
  serveObject?: object;
}

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
