import { CpCallBase } from "./cpc_base.ts";
import { getServe, type ServeObjectRoot } from "./registrar.ts";
import type { CpcFrameSource } from "./type.ts";
import type { RpcFrame } from "../core/type.ts";

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

  #separator = ".";
  #root: ServeObjectRoot = { object: {} };
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
export type MakeCallers<T extends object, E extends object = {}> =
  & E
  & {
    [Key in keyof T as T[Key] extends object ? Key : never]: T[Key] extends object ? MakeCallers<T[Key], E> : never;
  }
  & (T extends (...args: infer A) => infer R ? (...args: A) => Promise<Awaited<R>> : {});

/**
 * @public
 * @category Rpc
 */
export type MakeEmitter<T extends object, E extends object = {}> =
  & E
  & {
    [Key in keyof T as T[Key] extends object ? Key : never]: T[Key] extends object ? MakeCallers<T[Key], E> : never;
  }
  & (T extends (...args: infer A) => any ? (...args: A) => void : {});
