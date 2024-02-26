import {
  CalleeCommon,
  CalleePassive,
  CallerCore,
  RpcFrame,
  createFrameIterator,
  packageCpcFrame,
} from "../core/mod.js";
import type { CpCaller } from "../type.js";
import { createEvent } from "evlib";
import { RpcFn, genRpcCmdMap } from "./class_gen.js";
import { createCallerGen, MakeCallers, ToAsync } from "./callers_gen.js";

/** 提供最基础的命令调用 */
class CpCallBase {
  /**
   * @param onDispose 调用 dispose() 时调用。它这应该中断 frameIter。
   */
  constructor(
    frameIter: AsyncIterable<RpcFrame>,
    sendFrame: (frame: RpcFrame) => void,
    private onDispose?: () => void
  ) {
    const caller = new CallerCore(sendFrame);
    const callee = new CalleePassive(sendFrame);
    this.#caller = caller;
    this.caller = caller;
    this.callee = callee;
    this.bridgeRpcFrame(callee, caller, frameIter);
    callee.onCall = (cmd, ...args) => {
      const context = this.licensers.get(cmd);
      if (!context) throw new CpcUnregisteredCommandError();
      return context.fn.apply(context.this, args);
    };
    this.#caller.$finish.on(() => {
      if (this.callee.$finish.done) this.#emitClose();
    });
    this.callee.$finish.on(() => {
      if (this.#caller.$finish.done) this.#emitClose();
    });
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
        if (callee.status === 2 && caller.closed) throw new Error("Received frame after CpCall closed");
        callee.onFrame(chunk) || caller.onFrame(chunk);

        // 发送完某一帧后，需要检测是否满足结束状态，如果满足，需要发出close 事件以终止外部的迭代器
      }
      if (!caller.closed || callee.status !== 2) throw new Error("There won't be any more frames");
    } catch (err) {
      this.#errored = err;
      caller.end(true);
      this.disable(true);
    }
  }
  protected licensers = new Map<string, RpcFn>();
  /** @remarks 设置调用服务 */
  setFn(cmd: any, fn: CmdFn, opts: FnOpts = {}): void {
    this.licensers.set(cmd, { fn, this: opts.this });
  }
  /** @remarks 删除调用服务 */
  removeFn(cmd: any) {
    this.licensers.delete(cmd);
  }
  /** @remarks 获取已注册的所有命令和回调函数的映射 */
  getAllFn() {
    return this.licensers.keys();
  }
  /** @remarks 清空所有以设置的调用服务 */
  clearFn() {
    this.licensers.clear();
  }
  protected readonly callee: CalleePassive;
  readonly #caller: CpCaller;
  caller: CpCaller;
  #errored: any;
  /** @remarks 关闭事件 */
  $close = createEvent<void, any>();
  #emitClose() {
    if (this.#errored === undefined) this.$close.emit();
    else this.$close.emit(this.#errored, true);
    this.$close.close();
  }
  /** @remarks  */
  disable(force?: boolean) {
    return this.callee.disable(force);
  }
  /**
   * @remarks 强制关闭
   */
  dispose(): Promise<void> {
    const close = this.$close();
    this.disable(true);
    this.caller.end(true);
    this.onDispose?.();
    return close;
  }
}
export { type MakeCallers };
/**
 * @public
 */
export class CpCall extends CpCallBase {
  static fromByteIterable(
    iter: AsyncIterable<Uint8Array>,
    write: (binaryFrame: Uint8Array) => void,
    onDispose?: () => void
  ) {
    return new this(createFrameIterator(iter), (frame) => write(packageCpcFrame(frame)), onDispose);
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
