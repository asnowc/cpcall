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

/** 提供最基础的命令调用 */
class CpCallBase {
  constructor(frameIter: AsyncIterable<RpcFrame>, sendFrame: (frame: RpcFrame) => void) {
    const caller = new CallerCore(sendFrame);
    const callee = new CalleePassive(sendFrame);
    this.caller = caller;
    this.callee = callee;
    this.bridgeRpcFrame(callee, caller, frameIter);
    callee.onCall = (cmd, ...args) => {
      const context = this.licensers.get(cmd);
      if (!context) throw new CpcUnregisteredCommandError();
      return context.fn.apply(context.this, args);
    };
    this.caller.$finish.on(() => {
      if (this.callee.$finish.done) this.#emitClose();
    });
    this.callee.$finish.on(() => {
      if (this.caller.$finish.done) this.#emitClose();
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
  setFn(cmd: any, fn: CmdFn, opts: FnOpts = {}): void {
    this.licensers.set(cmd, { fn, this: opts.this });
  }
  removeFn(cmd: any) {
    this.licensers.delete(cmd);
  }
  /** 获取已注册的所有命令和回调函数的映射 */
  getAllFn() {
    return this.licensers.keys();
  }
  protected readonly callee: CalleePassive;
  readonly caller: CpCaller;
  #errored: any;
  $close = createEvent<void, any>();
  #emitClose() {
    if (this.#errored === undefined) this.$close.emit();
    else this.$close.emit(this.#errored, true);
    this.$close.close();
  }
  disable(force?: boolean) {
    return this.callee.disable(force);
  }
}
/**
 * @public
 */
export class CpCall extends CpCallBase {
  static fromByteIterable(iter: AsyncIterable<Uint8Array>, write: (binaryFrame: Uint8Array) => void) {
    return new this(createFrameIterator(iter), (frame) => write(packageCpcFrame(frame)));
  }
  setObject(obj: object, cmd: string = "") {
    genRpcCmdMap(obj, cmd, { map: this.licensers, exclude: Object, sp: "." });
  }
}

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
