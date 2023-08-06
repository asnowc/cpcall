import { UniqueKeyMap } from "../common/virtual_heap.js";
import { EventEmitter } from "../common/event_emitter.js";
import { PromiseHandel, SyncReturnQueue } from "./promise_queue.js";
import {
    CpcCmdList,
    CpcError,
    CpcFailAsyncRespondError,
    CpcFailRespondError,
    CpcUnregisteredCommandError,
} from "./cpc_frame.type.js";

/**
 * @description Cross-process call (跨进程调用-CPC)
 *
 * 事件触发顺序：end->close
 */
export abstract class Cpc<
    CallList extends CpcCmdList = CpcCmdList,
    CmdList extends CpcCmdList = CpcCmdList
> extends EventEmitter {
    constructor(maxAsyncId = 4294967295) {
        super();
        this.#sendingUniqueKey = new UniqueKeyMap(maxAsyncId);
    }
    #closed: boolean = false;
    /** 如果为true，Cpc将不再可用 */
    get closed() {
        return this.#closed;
    }
    /** 是否已发送fin帧。 */
    get isEnded() {
        return this.#end;
    }
    #end = false;
    /**
     * 调用后将清除所有已设置命令，进入等待关闭状态，并且无法再执行call()、和setCmd()方法。
     * 当执行end()后如果不存在回调等待，则会自动调用dispose(), 否则等待所有回调完成后执行dispose()
     */
    end() {
        if (this.#end) return;
        this.sendEnd();
        this.finalEnd();
    }

    /**
     * 销毁Cpc实例，这将会调用 Duplex 的 end() 和 destroy()
     */
    dispose(error?: Error) {
        if (this.closed) return;
        if (!this.#end) {
            this.#end = true;
            this.emit("end");
        }
        this.finalClose(error);
    }
    /** 最后的Cpc对象清理操作 */
    protected finalClose(error?: Error) {
        this.#closed = true;
        this.#licensers.clear();
        this.#syncReturnQueue.rejectAllByClass(CpcFailRespondError);
        this.#syncReturnQueue.rejectAsyncAllByClass(CpcFailAsyncRespondError);

        this.emit("close", error);
    }
    /** 最后的End操作 */
    protected finalEnd() {
        this.#end = true;
        this.emit("end");
        this.testClose();
    }
    #licensers = new Map<string | number, CmdFx>();
    setCmd<T extends keyof CpcCmdList>(cmd: T, fx: CpcCmdList[T]): void;
    setCmd(cmd: string | number, fx: CmdFx) {
        if (this.#end) return;
        this.#licensers.set(cmd, fx);
    }
    removeCmd(cmd: string | number) {
        this.#licensers.delete(cmd);
    }
    /** 获取已注册的所有命令和回调函数的映射 */
    getAllCmd() {
        return Object.fromEntries(this.#licensers);
    }

    /**
     * @param options 执行选项
     *
     * @throws {CpcUnregisteredCommandError} 调用未注册的命令
     * @throws {CpcFailRespondError}  在返回前断开连接
     * @throws {CpcFailAsyncRespondError} 已返回 AsyncId (命令已被执行), 但Promise状态在变化前断开连接
     */
    call<T extends keyof PickVoidCallList<CallList>>(command: T): Promise<ReturnType<CallList[T]>>;
    call<T extends keyof CallList, Fn extends CallList[T]>(command: T, arg: Parameters<Fn>): Promise<ReturnType<Fn>>;
    call<T extends keyof CallList, Fn extends CallList[T]>(
        command: T,
        arg: Parameters<Fn>,
        options: CallOptions
    ): Promise<ReturnType<Fn>>;
    call(command: string | number, args?: any[], options?: CallOptions) {
        if (this.#end) throw new Error("Cpc is ended");
        this.sendCall(command, args);
        return this.#syncReturnQueue.add(options ?? {});
    }

    exec<T extends keyof CallList>(command: T, args: any[]): void;
    exec(command: string | number, args: any[]) {
        if (this.#end) throw new Error("Cpc is ended");
        this.sendCall(command, args, true);
    }
    #syncReturnQueue = new SyncReturnQueue<CallOptions>();

    protected onCpcError(error: Error) {
        this.emit("error", error);
    }

    protected abstract sendReturn(arg: any, error?: boolean, isNoExist?: boolean): void;
    protected abstract sendReturnAsync(id: any): void;
    protected abstract sendAsyncRes(id: number, arg?: any, error?: boolean): void;
    protected abstract sendCall(command: string | number, args?: any[], ignoreReturn?: boolean): void;
    protected abstract sendEnd(): void;

    private handleAwait(handle: PromiseHandel<any, any> & CallOptions, value: any, error?: boolean) {
        if (error) handle.reject(value);
        else {
            handle.resolve(value);
        }
        this.testClose();
    }
    private beforeSendReturn(value: any, isError?: boolean): void {
        this.sendReturn(value, isError);
    }

    protected onCpcReturn(arg: any, error?: boolean, isNoExist?: boolean) {
        let res = this.#syncReturnQueue.shift();
        if (!res) return this.onCpcError(new CpcError("Redundant return"));
        if (isNoExist) return res.reject(new CpcUnregisteredCommandError());
        this.handleAwait(res, arg, error);
    }
    protected onCpcReturnAsync(id: number) {
        if (!this.#syncReturnQueue.swapInAsyncMap(id)) {
            return this.onCpcError(new CpcError("Redundant return"));
        }
    }
    protected onCpcAsyncRes(id: any, arg?: any, error?: boolean) {
        let res = this.#syncReturnQueue.takeAsyncItem(id);
        if (!res) return this.onCpcError(new CpcError("Invalid async ID"));

        this.handleAwait(res, arg, error);
    }
    protected onCpcCall(cmd: string | number, args: any[], ignoreReturn?: boolean) {
        let fx = this.#licensers.get(cmd);
        if (typeof fx !== "function") {
            if (ignoreReturn) return;
            return this.sendReturn(undefined, true, true);
        }
        let res;
        let isError: boolean = false;
        try {
            res = fx.apply(this, args);
        } catch (error) {
            res = error;
            isError = true;
        }
        if (ignoreReturn) return;

        if (res instanceof Promise) return this.#handelReturnAsync(res);
        this.beforeSendReturn(res, isError);
    }
    protected onCpcEnd() {
        if (this.#end) return;
        this.finalEnd();
    }
    protected testClose() {
        if (this.closeable) this.dispose();
    }
    protected get closeable() {
        if (!this.#end) return false;
        if (this.#syncReturnQueue.hasItem || this.#sendingUniqueKey.size) return false;
        return true;
    }

    #handelReturnAsync(pms: Promise<any>) {
        const id = this.#sendingUniqueKey.allowKeySet(pms);
        pms.then(
            (data) => this.sendAsyncRes(id, data),
            (err) => this.sendAsyncRes(id, err, true)
        ).finally(() => {
            this.#sendingUniqueKey.delete(id);
            this.testClose();
        });
        this.sendReturnAsync(id);
    }
    /** 等待异步发送的堆 */
    readonly #sendingUniqueKey: UniqueKeyMap;
}

Cpc.prototype.callNoCheck = Cpc.prototype.call;

export interface Cpc<CallList extends CpcCmdList, CmdList extends CpcCmdList = CpcCmdList> {
    on(name: "end", listener: (msg?: string) => void): this;
    on(name: "close", listener: () => void): this;
    on(name: "error", listener: (error: Error) => void): this;
    on(eventName: string | symbol, listener: (...args: any[]) => void): this;
    off(name: "end" | "close" | "error" | string): this;
    /** call的别名，用于绕靠类型检查 */
    callNoCheck<T extends keyof CallList, P>(command: T, args?: any[], options?: CallOptions): Promise<P>;
}

interface CallOptions {}
type CmdFx = (...args: any[]) => any;

type PickVoidCallList<T extends CpcCmdList> = {
    [key in keyof T as Parameters<T[key]> extends [] ? key : never]: T[key];
};
