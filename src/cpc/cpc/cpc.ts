import { genRpcCmdMap } from "./class_gen.ts";
import { JbodFrameSource } from "./ByteFrameCtrl.ts";
import { CpCallBase, CpCallOption, CpcFrameSource } from "./cpc_base.ts";
import { createObjectChain, getChainPath } from "evlib/object";
import { ServeFnTransform, SetServeFnOption } from "../core/type.ts";

/**
 * @public
 */
export class CpCall extends CpCallBase {
  /**
   * 创建基于 JBOD 编解码的CpCall实例。
   * @remarks  它会将 CpCall 在一个宏任务内的生成的帧进行打包
   */
  static fromJbodFrameSource(ctrl: CpcFrameSource<Uint8Array>, option?: CpCallOption) {
    return new this(new JbodFrameSource(ctrl), option);
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
  protected onCall(rawArgs: any[]) {
    let cmd = rawArgs[0];
    let args = rawArgs.slice(1);
    if (typeof cmd === "string") {
      const context = this.#licensers.get(cmd);
      if (!context) throw new CpcUnregisteredCommandError(cmd);
      if (context.transformArgs) args = context.transformArgs.call(undefined, args);
      let res = context.fn.apply(context.this, args);
      if (context.transformReturn) {
        if (res instanceof Promise) res = res.then(context.transformReturn);
        else res = context.transformReturn.call(undefined, res);
      }
      return res;
    }
    throw new CpcUnregisteredCommandError(cmd);
  }
  readonly #licensers = new Map<string, ServeContext>();
  /**
   * 设置可调用函数
   * @param cmd - 方法名称
   */
  setFn<A extends any[] = any[], R = any>(
    cmd: any,
    fn: (...args: A) => R,
    option: SetServeFnOption & ServeFnTransform<A, Awaited<R>> = {}
  ): void {
    const { transformArgs, transformReturn } = option;
    if (transformArgs && typeof transformArgs !== "function") throw new Error("transformArgs must be a function");
    if (transformReturn && typeof transformReturn !== "function") throw new Error("transformArgs must be a function");

    this.#licensers.set(cmd, {
      fn,
      this: option.this,
      transformArgs,
      transformReturn,
    });
  }
  /** 删除可调用函数 */
  removeFn(cmd: any) {
    this.#licensers.delete(cmd);
  }
  /** 获取所有已设置的可调用函数，包括 setObject 设置的对象 */
  getAllFn() {
    return this.#licensers.keys();
  }
  /** 清空所有已设置的可调用函数，包括 setObject 设置的对象  */
  clearFn() {
    this.#licensers.clear();
  }

  // protected _getFn(cmd: string): RpcFn | undefined {
  //   const path = cmd.split(this.#sp);
  //   return getObjByPath(this.#object, path);
  // }
  // #object: Record<string | number, any> = {};
  #separator = ".";
  /** 设置远程可调用对象。 */
  setObject(obj: object, cmd?: string): void;
  /** 设置远程可调用对象。 */
  setObject(obj: object, cmd: ParseObjectOption): void;
  setObject(obj: object, cmd_opts?: string | ParseObjectOption) {
    const map = new Map<string, any>();
    let opts: ParseObjectOption = typeof cmd_opts === "string" ? { cmd: cmd_opts } : cmd_opts ?? {};
    genRpcCmdMap(obj, opts.cmd ?? "", {
      map: map,
      sp: this.#separator,
      deep: opts.deep ?? 2,
    });
    for (const [k, v] of map) {
      this.#licensers.set(k, v);
    }
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
type ServeContext = ServeFnTransform<any, any> & {
  this?: object;
  fn: ServeFn;
};
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
  /** 解析的最大深度，默认为 2 */
  deep?: number;
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
