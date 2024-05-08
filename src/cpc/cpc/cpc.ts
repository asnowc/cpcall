import { CalleeCommon, CalleePassive, CallerCore, RpcFrame, trans, CpCaller } from "../core/mod.js";
import { OnceEventTrigger } from "evlib";
import { RpcFn, genRpcCmdMap } from "./class_gen.js";
import { createCallerGen, MakeCallers, ToAsync } from "./callers_gen.js";

/** @public */
export type RpcFrameCtrl<T = RpcFrame> = {
  frameIter: AsyncIterable<T>;
  sendFrame(frame: T): void;
  /**
   * @remarks 在 closeEvent 发出前调用
   */
  close?(): Promise<void> | void;
  /**
   *  @remarks  当用户手动调用 dispose() 时或迭代器抛出异常时调用
   */
  dispose?(reason?: any): void;
};

/** @internal 提供最基础的命令调用 */
export abstract class CpCallBase {
  /**
   * @param onDispose - 调用 dispose() 时调用。它这应该中断 frameIter。
   */
  constructor(private readonly ctrl: RpcFrameCtrl<RpcFrame>) {
    const caller = new CallerCore(ctrl);
    const callee = new CalleePassive(ctrl);
    this.#caller = caller;
    this.caller = caller;
    this.callee = callee;
    this.bridgeRpcFrame(callee, caller, ctrl.frameIter);
    callee.onCall = (cmd, ...args) => {
      const context = this.licensers.get(cmd);
      if (!context) throw new CpcUnregisteredCommandError();
      return context.fn.apply(context.this, args);
    };
  }
  /**
   * @internal
   * @throws 继承自 frameIter
   */
  private async bridgeRpcFrame(
    callee: CalleeCommon,
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
  protected licensers = new Map<string, RpcFn>();
  /**
   * @remarks 设置函数服务，设置后，可由对方调用
   * @param cmd - 方法名称
   */
  setFn(cmd: any, fn: CmdFn, opts: FnOpts = {}): void {
    this.licensers.set(cmd, { fn, this: opts.this });
  }
  /** @remarks 删除函数服务 */
  removeFn(cmd: any) {
    this.licensers.delete(cmd);
  }
  /** @remarks 获取所有已设置的函数 */
  getAllFn() {
    return this.licensers.keys();
  }
  /** @remarks 清空所有已设置的函数 */
  clearFn() {
    this.licensers.clear();
  }
  protected readonly callee: CalleePassive;
  readonly #caller: CallerCore;
  caller: CpCaller;
  #errored: any;
  /** @remarks 关闭事件 */
  readonly closeEvent = new OnceEventTrigger<void>();
  /**
   * @remarks 向对方发送 disable 帧。调用后，对方如果继续发起远程调用，将会响应给对方异常
   **/
  disable() {
    return this.callee.disable();
  }
  /**
   * @remarks 销毁连接
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
export type { MakeCallers };
/**
 * @public
 */
export class CpCall extends CpCallBase {
  static fromByteIterable(ctrl: RpcFrameCtrl<Uint8Array>) {
    const config = {
      ctrl,
      frameIter: trans.createFrameIterator(ctrl.frameIter),
      sendFrame(frame: RpcFrame) {
        this.ctrl.sendFrame(trans.packageCpcFrame(frame));
      },
      dispose: ctrl.dispose
        ? function (this: any, reason: Error) {
            this.ctrl.dispose(reason);
          }
        : undefined,
      close: ctrl.close
        ? function (this: any) {
            this.ctrl.close();
          }
        : undefined,
    };
    return new this(config);
  }

  constructor(callerCtrl: RpcFrameCtrl<RpcFrame>) {
    super(callerCtrl);
  }
  #sp = ".";
  /** @remarks 根据对象设置调用服务 */
  setObject(obj: object, cmd: string = "") {
    const map = new Map<string, any>();
    genRpcCmdMap(obj, cmd, { map: map, sp: this.#sp });
    for (const [k, v] of map) {
      this.licensers.set(k, v);
    }
  }
  /**
   * @remarks 生成自动调用
   */
  genCaller(prefix?: string, opts?: GenCallerOpts): AnyCaller;
  genCaller<R extends object>(prefix?: string, opts?: GenCallerOpts): ToAsync<R, CallerProxyPrototype>;
  genCaller(prefix = "", opts: GenCallerOpts = {}): object {
    const { keepThen } = opts;
    let excludeKeys: Set<string> | undefined;
    if (!keepThen) excludeKeys = new Set(["then"]);
    const obj = createCallerGen(createCallerFn, { caller: this.caller, excludeKeys }, prefix, this.#sp);

    return obj;
  }
}

type GenCallerOpts = {
  /** @remarks 默认会添加 then 属性为 null，避免在异步函数中错误执行，如果为 true，则不添加  */
  keepThen?: boolean;
};
type AnyCaller = {
  [key: string]: AnyCaller;
} & ((...args: any[]) => Promise<any>);

type CmdFn = (...args: any[]) => any;

/**  @public 调用未注册的命令 */
export class CpcUnregisteredCommandError extends Error {
  constructor() {
    super("CpcUnregisteredCommandError");
  }
}
interface FnOpts {
  this?: object;
}

const callerSymbol = Symbol("cpcall symbol");
interface CpCallerProxyOrigin {
  (...args: any[]): any;
  [Symbol.asyncDispose](): Promise<void>;
  [callerSymbol]: CpCaller;
  [key: string]: any;
}
function createCallerFn(config: { caller: CpCaller; excludeKeys?: Set<string> }): {
  fn: CpCallerProxyOrigin;
  excludeKeys?: Set<string>;
} {
  function callerProxyOrigin(this: CpCallerProxyOrigin, ...args: any[]) {
    return this[callerSymbol].call(...args);
  }
  Reflect.setPrototypeOf(callerProxyOrigin, callerProxyPrototype);
  callerProxyOrigin[callerSymbol] = config.caller;
  return { fn: callerProxyOrigin as CpCallerProxyOrigin, excludeKeys: config.excludeKeys };
}
const callerProxyPrototype = {
  [Symbol.asyncDispose](): Promise<void> {
    return (this as any)[callerSymbol].end();
  },
};

type CallerProxyPrototype = typeof callerProxyPrototype;
Reflect.setPrototypeOf(callerProxyPrototype, Function.prototype);
