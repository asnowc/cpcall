import { CalleeCore, CallerCore, RpcFrame, CpCaller } from "../core/mod.js";
import { OnceEventTrigger } from "evlib";
import { RpcFn, genRpcCmdMap } from "./class_gen.js";
import { createObjectChain, getChainPath } from "./callers_gen.js";
import { ByteFrameCtrl } from "./ByteFrameCtrl.js";

/** CpCall 构造函数依赖的接口。你可以实现自定义编解码器，或数据帧转发服务
 * @public
 */
export type RpcFrameCtrl<T = RpcFrame> = {
  /** 一个异步迭代器，它应迭代 cpcall 数据帧 */
  frameIter: AsyncIterable<T>;
  /** 当需要发送数据帧时被调用 */
  sendFrame(frame: T): void;
  /** 在 closeEvent 发出前调用 */
  close?(): Promise<void> | void;
  /** 当用户手动调用 dispose() 时或迭代器抛出异常时调用  */
  dispose?(reason?: any): void;
};

/** 提供最基础的命令调用
 * @internal  */
export abstract class CpCallBase {
  /**
   * @param onDispose - 调用 dispose() 时调用。它这应该中断 frameIter。
   */
  constructor(private readonly ctrl: RpcFrameCtrl<RpcFrame>) {
    const caller = new CallerCore(ctrl);
    const callee = new CalleeCore(ctrl);
    this.#caller = caller;
    this.caller = caller;
    this.callee = callee;
    this.bridgeRpcFrame(callee, caller, ctrl.frameIter);
    callee.onCall = (cmd, ...args) => {
      if (typeof cmd === "string") {
        const context = this._getFn(cmd);
        if (!context) throw new CpcUnregisteredCommandError();
        return context.fn.apply(context.this, args);
      }
      throw new CpcUnregisteredCommandError();
    };
  }
  protected _getFn(cmd: string): RpcFn | undefined {
    return this._licensers.get(cmd);
  }
  /**
   * @internal
   * @throws 继承自 frameIter
   */
  private async bridgeRpcFrame(
    callee: CalleeCore,
    caller: CallerCore,
    frameIter: AsyncIterable<RpcFrame>
  ): Promise<void | any> {
    try {
      for await (const chunk of frameIter) {
        callee.onFrame(chunk) || caller.onFrame(chunk);
        if (callee.status === 2 && caller.closed) break; // 检测是否满足结束状态，如果满足，终止外部的迭代器
      }
      if (callee.status !== 2) this.callee.forceAbort();
      if (!caller.closed) this.#caller.forceAbort();
      await this.ctrl.close?.();
      this.closeEvent.emit();
    } catch (err) {
      this.dispose(err);
    }
  }
  protected _licensers = new Map<string, RpcFn>();
  /** 设置可调用函数
   * @param cmd - 方法名称
   */
  setFn(cmd: any, fn: CmdFn, opts: FnOpts = {}): void {
    this._licensers.set(cmd, { fn, this: opts.this });
  }
  /** 删除可调用函数 */
  removeFn(cmd: any) {
    this._licensers.delete(cmd);
  }
  /** 获取所有已设置的可调用函数，包括 setObject 设置的对象 */
  getAllFn() {
    return this._licensers.keys();
  }
  /** 清空所有已设置的可调用函数，包括 setObject 设置的对象  */
  clearFn() {
    this._licensers.clear();
  }
  protected readonly callee: CalleeCore;
  readonly #caller: CallerCore;
  /** CpCaller 对象**/
  caller: CpCaller;
  #errored: any;
  /** 关闭事件 */
  readonly closeEvent = new OnceEventTrigger<void>();
  /** 向对方发送 disable 帧
   * @remarks
   * 调用后，对方如果继续发起远程调用，将会响应给对方异常。
   * 为保证连接能正常关闭，当不再提供调用服务时，应手动调用。
   **/
  disable() {
    return this.callee.disable();
  }
  /** 销毁连接
   * @returns 返回 CpCall 完全关闭后解决的 Promise
   */
  dispose(reason: any = null): void {
    if (this.#errored !== undefined) return; //已经销毁过
    this.#errored = reason;
    this.callee.forceAbort();
    this.#caller.forceAbort();
    this.ctrl.dispose?.(reason);
    this.closeEvent.emitError(this.#errored);
  }
}

/**
 * @public
 */
export class CpCall extends CpCallBase {
  /** 创建基于 JBOD 编解码的CpCall实例 */
  static fromByteIterable(ctrl: RpcFrameCtrl<Uint8Array>) {
    return new this(new ByteFrameCtrl(ctrl));
  }
  static #getProxyInfo(proxyObj: (...args: any[]) => any) {
    const cpc: CpCall = Reflect.get(proxyObj, cpcallRemoteObject);
    if (!(cpc instanceof CpCall)) throw new Error("The target is not a remote cpcall proxy object");
    const path = getChainPath(proxyObj);
    if (path.length === 0) throw new Error("Top-level calls are not allowed");
    return { cpc, path: path.join(cpc.#sp) };
  }
  /** 通过 exec 调用远程代理对象
   *
   * @example
   *
   * ```ts
   * const api= cpc.genCaller()
   * CpCall.exec(api.a.b,"arg1","arg2") //这等价与 cpc.caller.exec("api.a.b","arg1","arg2")
   *
   * ```
   */
  static exec<T extends (...args: any[]) => any>(proxyObj: T, ...args: Parameters<T>): void {
    const { cpc, path } = CpCall.#getProxyInfo(proxyObj);
    cpc.caller.exec(path, ...args);
  }
  /** 通过 call 调用远程代理对象
   *
   * @example
   *
   * ```ts
   * const api= cpc.genCaller()
   * CpCall.call(api.a.b,"arg1","arg2") //这等价于 cpc.caller.call("api.a.b","arg1","arg2")
   *
   * ```
   */
  static call<T extends (...args: any[]) => any>(proxyObj: T, ...args: Parameters<T>): ReturnType<T> {
    const { cpc, path } = CpCall.#getProxyInfo(proxyObj);
    return cpc.caller.call(path, ...args) as Promise<any> as any;
  }
  constructor(callerCtrl: RpcFrameCtrl<RpcFrame>) {
    super(callerCtrl);
  }
  // protected _getFn(cmd: string): RpcFn | undefined {
  //   const path = cmd.split(this.#sp);
  //   return getObjByPath(this.#object, path);
  // }
  // #object: Record<string | number, any> = {};
  #sp = ".";
  /** 设置远程可调用对象。 */
  setObject(obj: object, cmd: string = "") {
    const map = new Map<string, any>();
    genRpcCmdMap(obj, cmd, { map: map, sp: this.#sp });
    for (const [k, v] of map) {
      this._licensers.set(k, v);
    }
  }

  /** 生成远程代理对象 */
  genCaller(prefix?: string, opts?: GenCallerOpts): AnyCaller;
  genCaller<R extends object>(prefix?: string, opts?: GenCallerOpts): ChianProxy<R, CallerProxyPrototype>;
  genCaller(prefix = "", opts: GenCallerOpts = {}): object {
    const keepThen = opts.keepThen;
    return createObjectChain(prefix, undefined, () => {
      function src(args: any[], thisArg: any, target: CmdFn) {
        return CpCall.call(target, ...args);
      }
      if (!keepThen) Reflect.set(src, "then", null);

      Reflect.set(src, cpcallRemoteObject, this);
      Reflect.setPrototypeOf(src, callerProxyPrototype);
      return src;
    });
  }
}

type GenCallerOpts = {
  /** 默认会添加 then 属性为 null，避免在异步函数中错误执行，如果为 true，则不添加 */
  keepThen?: boolean;
};
type AnyCaller = CallerProxyPrototype &
  ((...args: any[]) => Promise<any>) & {
    [key: string]: AnyCaller;
  };

type CmdFn = (...args: any[]) => any;

/** 调用未注册的命令
 * @public */
export class CpcUnregisteredCommandError extends Error {
  constructor() {
    super("CpcUnregisteredCommandError");
  }
}
interface FnOpts {
  this?: object;
}

const cpcallRemoteObject = Symbol("cpcall remote object");

const callerProxyPrototype = {
  [Symbol.asyncDispose](): Promise<void> {
    return (this as CallerProxyPrototype)[cpcallRemoteObject].caller.end();
  },
};

type CallerProxyPrototype = typeof callerProxyPrototype & {
  [cpcallRemoteObject]: CpCall;
};

type ChianProxy<T extends object, E extends object> = E & {
  [Key in keyof T as T[Key] extends object ? Key : never]: T[Key] extends object ? MakeCallers<T[Key], E> : never;
};
/** @public */
export type MakeCallers<T extends object, E extends object = {}> = T extends (...args: infer A) => infer R
  ? MakeCallerFn<A, R> & ChianProxy<T, E>
  : ChianProxy<T, E>;

type MakeCallerFn<A extends any[], R> = (...args: A) => ToPromise<R>;
type ToPromise<T> = T extends Promise<any> ? T : Promise<T>;
