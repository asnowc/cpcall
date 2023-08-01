import { UniqueKeyMap } from "../common/virtual_heap.js";
import { EventEmitter } from "node:events";

/**
 * @description Cross-process call (跨进程调用-CPC)
 *
 * 事件触发顺序：end->close
 */
export abstract class Cpc<
    CallableCmd extends CpcCallList = CpcCallList,
    CmdList extends CpcCallList = CpcCallList
> extends EventEmitter {
    constructor(protected readonly maxAsyncId = 4294967295) {
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
        let queue = this.#waitingQueue;
        this.#waitingQueue = [];
        for (const { reject } of queue) reject(new CpcFailRespondError());

        for (const [id, { reject }] of this.#receivingMap) reject(new CpcFailAsyncRespondError());
        this.#receivingMap.clear();

        this.emit("close", error);
    }
    /** 最后的End操作 */
    protected finalEnd() {
        this.#end = true;
        this.emit("end");
        this.testClose();
    }
    #licensers = new Map<string | number, CmdFx>();
    setCmd<T extends keyof CpcCallList>(cmd: T, fx: CpcCallList[T]): void;
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
     * @throws {CpcUnregisteredCommandError} 调用未注册的命令
     * @throws {CpcFailRespondError}  在返回前断开连接
     * @throws {CpcFailAsyncRespondError} 已返回 AsyncId (命令已被执行), 但Promise状态在变化前断开连接
     */
    call<T extends keyof CallableCmd>(
        command: T,
        arg?: Parameters<CallableCmd[T]>
    ): Promise<ReturnType<CallableCmd[T]>>;
    call(command: string | number, args?: any[], ignoreReturn?: boolean) {
        if (this.#end) throw new Error("Cpc is ended");
        if (ignoreReturn) {
            this.sendCall(command, args, ignoreReturn);
            return;
        }
        return new Promise((resolve, reject) => {
            this.#waitingQueue.push({ resolve, reject });
            this.sendCall(command, args);
        });
    }
    /** call()的别名，用于辅助Ts类型提示 */
    callWithArgs<T extends keyof CallableCmd>(command: T, args: Parameters<CallableCmd[T]>) {
        return this.call(command, args);
    }
    #waitingQueue: WaitingQueueItem[] = [];
    protected onCpcError(error: Error) {
        this.emit("error", error);
    }

    protected abstract sendReturn(arg: any, error?: boolean, isNoExist?: boolean): void;
    protected abstract sendReturnAsync(id: any): void;
    protected abstract sendAsyncRes(id: number, arg?: any, error?: boolean): void;
    protected abstract sendCall(command: string | number, args?: any[], ignoreReturn?: boolean): void;
    protected abstract sendEnd(): void;
    protected onCpcReturn(arg: any, error?: boolean, isNoExist?: boolean) {
        let res = this.#waitingQueue.shift();
        if (!res) return this.onCpcError(new CpcError("Redundant return"));
        if (error) res.reject(isNoExist ? new CpcUnregisteredCommandError() : arg);
        else res.resolve(arg);
        this.testClose();
    }
    protected onCpcReturnAsync(id: number) {
        let res = this.#waitingQueue.shift();
        if (!res) return this.onCpcError(new CpcError("Redundant return"));
        this.#receivingMap.set(id, res);
    }
    protected onCpcAsyncRes(id: any, arg?: any, error?: boolean) {
        let res = this.#receivingMap.get(id);
        if (!res) return this.onCpcError(new CpcError("Invalid async ID"));
        this.#receivingMap.delete(id);
        if (error) res.reject(arg);
        else res.resolve(arg);
        this.testClose();
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
        if (res instanceof Promise) this.#handelReturnAsync(res);
        else this.sendReturn(res, isError);
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
        if (this.#waitingQueue.length || this.#sendingUniqueKey.size || this.#receivingMap.size) return false;
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
    /** 等待异步响应的堆 */
    readonly #receivingMap = new Map<number, WaitingQueueItem>();
    /** 等待异步发送的堆 */
    readonly #sendingUniqueKey: UniqueKeyMap;
}

export interface Cpc<CallableCmd extends CpcCallList, CmdList extends CpcCallList = CpcCallList> {
    on(name: "end", listener: (msg?: string) => void): this;
    on(name: "close", listener: () => void): this;
    on(name: "error", listener: (error: Error) => void): this;
    on(eventName: string | symbol, listener: (...args: any[]) => void): this;
    off(name: "end" | "close" | "error" | string): this;
}
type CmdFx = (...args: any[]) => any;
type WaitingQueueItem = { resolve: (arg: any) => void; reject: (err?: Error) => void };

export type CpcCallList = {
    [key: string | number]: (...args: any[]) => any;
};

export class CpcError extends Error {}

/** 调用失败 */
export class CpcCallError extends Error {
    constructor(msg?: string) {
        super("CallError");
    }
}
/** 在返回前断开连接 */
export class CpcFailRespondError extends CpcCallError {}
/** 已返回 AsyncId (命令已被执行), 但Promise状态在变化前断开连接*/
export class CpcFailAsyncRespondError extends CpcFailRespondError {}
/** 调用未注册的命令 */
export class CpcUnregisteredCommandError extends CpcCallError {}
