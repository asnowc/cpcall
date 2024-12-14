import { CpCallBase } from "./cpc_base.ts";
import { createObjectChain, getChainPath } from "../../deps/evlib.ts";
import { getServe, ServeObjectRoot } from "./registrar.ts";
import { CpcFrameSource } from "./type.ts";
import { RpcFrame } from "../core/type.ts";

export { ServiceDefineMode } from "./registrar.ts";
export * from "./decorate.ts";
/**
 * RPC 调用与服务实例
 * @public
 * @category Rpc
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
        this.exposeObject(config.serveObject);
      }
    }
  }
  /** 通过 exec 调用远程代理对象
   *
   * @example
   *
   * ```ts
   * const api= cpc.genCaller()
   * CpCall.exec(api.a.b,"arg1","arg2") //这等价于 cpc.exec("api.a.b","arg1","arg2")
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

  /** 设置可调用的服务 */
  exposeObject(obj: object): void;
  /** 删除可调用服务 */
  exposeObject(obj?: undefined): void;
  exposeObject(obj?: object): void;
  exposeObject(obj: object = {}) {
    if (typeof obj !== "object" || obj === null) throw new Error("obj must be an object");
    this.#root = { object: obj };
  }
  /** @deprecated 改用 exposeObject */
  setObject(obj: object = {}): void {
    return this.exposeObject(obj);
  }

  #separator = ".";
  #root: ServeObjectRoot = { object: {} };

  /**
   * 生成代理调用对象
   * @example
   * ```
   * const proxy=cpc.genCaller()
   * proxy.a.b(1, 2) //这等价于 cpc.call("a.b", 1, 2)
   *
   * const proxy=cpc.genCaller("base.api")
   * proxy.a.b(1, 2) //这等价于 cpc.call("base.api.a.b", 1, 2)
   * ```
   */
  genCaller(opts?: GenCallerOpts): AnyCaller;
  /**
   * 生成代理调用对象
   * @param base - 前缀
   */
  genCaller(base: string, opts?: GenCallerOpts): AnyCaller;
  /**
   * 生成代理调用对象
   * @param base - 前缀
   */
  genCaller<R extends object>(base: string, opts?: GenCallerOpts): MakeCallers<R>;
  /**  生成代理调用对象 */
  genCaller<R extends object>(opts?: GenCallerOpts): MakeCallers<R>;
  genCaller(base_opts?: string | GenCallerOpts, opts?: GenCallerOpts): object {
    const param = initParam(base_opts, opts);
    const keepThen = param.opts.keepThen;
    return createObjectChain(param.base, undefined, () => {
      function src(args: any[], thisArg: any, target: (...args: any[]) => any) {
        return CpCall.call(target, ...args);
      }
      if (!keepThen) Reflect.set(src, "then", null);
      Reflect.set(src, CPC_SRC, this);
      Reflect.setPrototypeOf(src, callerProxyPrototype);
      return src;
    });
  }

  /** 生成代理执行对象， 与 genCaller 类似，只不过执行的是 cpc.exec() */
  getEmitter(opts?: GenCallerOpts): AnyEmitter;
  /**
   * 生成代理执行对象， 与 genCaller 类似，只不过执行的是 cpc.exec()
   * @param base - 前缀
   */
  getEmitter(base: string, opts?: GenCallerOpts): AnyEmitter;
  /**
   * 生成代理执行对象， 与 genCaller 类似，只不过执行的是 cpc.exec()
   * @param base - 前缀
   */
  getEmitter<T extends object>(base: string, opts?: GenCallerOpts): MakeEmitter<T>;
  /** 生成代理执行对象， 与 genCaller 类似，只不过执行的是 cpc.exec() */
  getEmitter<T extends object>(opts?: GenCallerOpts): MakeEmitter<T>;
  getEmitter(base_opts?: string | GenCallerOpts, opts?: GenCallerOpts) {
    const param = initParam(base_opts, opts);
    const keepThen = param.opts.keepThen;

    return createObjectChain(param.base, undefined, () => {
      function src(args: any[], thisArg: any, target: (...args: any[]) => any) {
        return CpCall.exec(target, ...args);
      }
      if (!keepThen) Reflect.set(src, "then", null);
      Reflect.set(src, CPC_SRC, this);
      Reflect.setPrototypeOf(src, callerProxyPrototype);
      return src;
    });
  }
}
function initParam(base_opts?: string | GenCallerOpts, opts?: GenCallerOpts) {
  let base: string;
  if (typeof base_opts === "string") {
    base = base_opts;
    if (!opts) opts = {};
  } else {
    base = "";
    opts = base_opts ?? {};
  }
  return { base, opts };
}

/** 调用未注册的命令
 * @public
 * @category Errors
 */
export class UnregisteredMethodError extends Error {
  constructor(cmd: any) {
    super("UnregisteredMethod: " + cmd);
  }
}

/**
 * @public
 * @category Rpc
 */
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
/**
 * @public
 * @category Rpc
 */
export interface CpCallOption {
  /** 禁用调用。如果为 true, 对方构造实例时 disableServe 必须为 true, 否则无法正常断开连接并触发 onClose */
  disableCall?: boolean;
  /** 禁用服务。如果为 true, 对方构造实例时 disableCall 必须为 true, 否则无法正常断开连接并触发 onClose */
  disableServe?: boolean;
  /** 设置服务对象 */
  serveObject?: object;
}

/**
 * 远程调用代理
 * @public
 * @category Rpc
 */
export type AnyCaller = {
  (...args: any[]): Promise<any>;
  [key: string]: AnyCaller;
};
/**
 * 远程触发代理
 * @public
 * @category Rpc
 */
export type AnyEmitter = {
  (...args: any[]): void;
  [key: string]: AnyCaller;
};
/**
 * @public
 * @category Rpc
 */
export type MakeCallers<T extends object, E extends object = {}> = E & {
  [Key in keyof T as T[Key] extends object ? Key : never]: T[Key] extends object ? MakeCallers<T[Key], E> : never;
} & (T extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : {});

/**
 * @public
 * @category Rpc
 */
export type MakeEmitter<T extends object, E extends object = {}> = E & {
  [Key in keyof T as T[Key] extends object ? Key : never]: T[Key] extends object ? MakeCallers<T[Key], E> : never;
} & (T extends (...args: infer A) => any ? (...args: A) => void : {});
