import { UniqueKeyMap } from "#lib/virtual_heap.js";
import { EventEmitter } from "#lib/event_emitter.js";
import { PromiseHandel, SyncReturnQueue } from "./promise_queue.js";
import {
    CpcError,
    CpcEvents,
    CpcFailAsyncRespondError,
    CpcFailRespondError,
    CpcUnknownFrameTypeError,
    CpcUnregisteredCommandError,
    FrameType,
} from "./cpc_frame.type.js";
import { VOID } from "#lib/js_bson.js";
export * from "./cpc_frame.type.js";

/**
 * @public
 * @description Cross-process call (跨进程调用-CPC)
 *
 * 事件触发顺序：end \> close
 */
export abstract class Cpc<
    CallList extends object = CpcCmdList,
    CmdList extends object = CpcCmdList,
    Ev extends CpcEvents = CpcEvents
> extends EventEmitter<Ev> {
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
        this.closeable && this.dispose();
    }
    #licensers = new Map<string | number, CmdFx>();
    // setCmd(cmd: string | number, target: Cpc, insp?: (returns: any) => any): void;
    setCmd<T extends GetCmds<CmdList>, Fn extends GetFn<CmdList[T]>>(cmd: T, fx: Fn): void;
    // setCmd(cmd: string | number, fx: CmdFx): void;
    setCmd(cmd: string | number, fx: CmdFx, options?: SetCmdOptions<CmdFx>) {
        if (this.#end) return;
        this.#licensers.set(cmd, fx);
    }
    removeCmd<T extends GetCmds<CmdList>>(cmd: T): void;
    removeCmd(cmd: string | number): void;
    removeCmd(cmd: string | number) {
        this.#licensers.delete(cmd);
    }
    /** 获取已注册的所有命令和回调函数的映射 */
    getAllCmd() {
        return Object.fromEntries(this.#licensers);
    }

    /**
     * @param options - 执行选项
     * @throws {CpcUnregisteredCommandError} 调用未注册的命令
     * @throws {CpcFailRespondError}  在返回前断开连接
     * @throws {CpcFailAsyncRespondError} 已返回 AsyncId (命令已被执行), 但Promise状态在变化前断开连接
     */
    call<T extends GetAnyVoidCmd<CallList>>(cmd: T): Promise<any>;
    call<T extends GetVoidCmds<CallList>, R = ReturnType<GetVoidFn<CallList[T]>>>(cmd: T): Promise<R>;
    call<T extends GetCmds<CallList>, Fn extends CmdFx = GetFn<CallList[T]>>(
        cmd: T,
        arg: Parameters<Fn>
    ): Promise<ReturnType<Fn>>;
    call<T extends GetCmds<CallList>, Fn extends CmdFx = GetFn<CallList[T]>>(
        cmd: T,
        arg: Parameters<Fn>,
        options: CallOptions
    ): Promise<ReturnType<Fn>>;
    call(command: string | number, args?: any[], options?: CallOptions) {
        if (this.#end) throw new Error("Cpc is ended");
        this.sendCall(command, args);
        return this.#syncReturnQueue.add(options ?? {});
    }

    exec<T extends GetAnyVoidCmd<CallList>>(cmd: T): void;
    exec<T extends GetVoidCmds<CallList>>(cmd: T): void;
    exec<T extends GetCmds<CallList>, Arg extends any[] = Parameters<GetFn<CallList[T]>>>(cmd: T, arg: Arg): void;
    exec(command: string | number, args?: any[]) {
        if (this.#end) throw new Error("Cpc is ended");
        this.sendCall(command, args, true);
    }
    #handelReturnAsync(pms: Promise<any>) {
        const id = this.#sendingUniqueKey.allowKeySet(pms);
        pms.then(
            (data) => this.sendAsyncRes(id, data),
            (err) => this.sendAsyncRes(id, err, true)
        ).finally(() => {
            this.#sendingUniqueKey.delete(id);
            this.closeable && this.dispose();
        });
        this.sendReturnAsync(id);
    }
    /** 等待返回给对方的 Promise 队列 */
    readonly #sendingUniqueKey: UniqueKeyMap;
    /** 等待对方返回的 Promise 队列 */
    #syncReturnQueue = new SyncReturnQueue<CallOptions>();

    protected onCpcError(error: Error) {
        this.emit("error", error);
    }

    private handleAwait(handle: PromiseHandel<any, any> & CallOptions, value: any, error?: boolean) {
        if (error) handle.reject(value);
        else {
            handle.resolve(value);
        }
        this.closeable && this.dispose();
    }
    private beforeSendReturn(value: any, isError?: boolean): void {
        this.sendReturn(value, isError);
    }
    private onCpcReturn(arg: any, error?: boolean, isNoExist?: boolean) {
        let res = this.#syncReturnQueue.shift();
        if (!res) return this.onCpcError(new CpcError("Redundant return"));
        if (isNoExist) return res.reject(new CpcUnregisteredCommandError());
        this.handleAwait(res, arg, error);
    }
    private onCpcReturnAsync(id: number) {
        if (!this.#syncReturnQueue.swapInAsyncMap(id)) {
            return this.onCpcError(new CpcError("Redundant return"));
        }
    }
    private onCpcAsyncRes(id: any, arg?: any, error?: boolean) {
        let res = this.#syncReturnQueue.takeAsyncItem(id);
        if (!res) return this.onCpcError(new CpcError("Invalid async ID"));

        this.handleAwait(res, arg, error);
    }
    private onCpcCall(cmd: any, args: any[], ignoreReturn?: boolean) {
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
    private onCpcEnd() {
        if (this.#end) return;
        this.finalEnd();
    }
    protected onCpcFrame(frame: CpcFrame) {
        switch (frame[0]) {
            case FrameType.call: {
                const [cmd, ...args] = frame[1];
                this.onCpcCall(cmd, args);
                break;
            }

            case FrameType.exec: {
                const [type, cmd, ...args] = frame;
                this.onCpcCall(cmd, args, true);
                break;
            }

            case FrameType.return:
                this.onCpcReturn(frame[1]);
                break;
            case FrameType.throw:
                this.onCpcReturn(frame[1], true, frame[1] === VOID);
                break;
            case FrameType.returnAsync:
                this.onCpcReturnAsync(frame[1]);
                break;
            case FrameType.resolve:
                this.onCpcAsyncRes(frame[1], frame[2]);
                break;
            case FrameType.reject:
                this.onCpcAsyncRes(frame[1], frame[2], true);
                break;

            case FrameType.fin:
                this.onCpcEnd();
                break;
            default:
                this.onCpcError(new CpcUnknownFrameTypeError((frame as any)?.type));
                break;
        }
    }

    /**
     * send
     */
    protected abstract sendFrame(frame: CpcFrame): void;
    private sendAsyncRes(id: number, arg?: any, error?: boolean | undefined): void {
        const frame: F_asyncRes = [error ? FrameType.reject : FrameType.resolve, id, arg];
        this.sendFrame(frame);
    }
    private sendCall(command: any, args: any[] = [], ignoreReturn?: boolean): void {
        const frame: F_call = [ignoreReturn ? FrameType.exec : FrameType.call, [command, ...args]];
        this.sendFrame(frame);
    }
    private sendEnd(): void {
        const frame: F_end = [FrameType.fin];
        this.sendFrame(frame);
    }
    private sendReturn(value: any, error?: boolean, isNoExist?: boolean): void {
        if (error) {
            const frame: F_throw = [FrameType.throw, isNoExist ? VOID : value];
            this.sendFrame(frame);
        } else {
            let frame: F_return = [FrameType.return, value];
            this.sendFrame(frame);
        }
    }
    private sendReturnAsync(id: any): void {
        let frame: F_returnAsync = [FrameType.returnAsync, id];
        this.sendFrame(frame);
    }

    /**
     * @remark Cpc 是否可正常关闭。Cpc需要等待各种队列清空
     */
    protected get closeable() {
        if (!this.#end) return false;
        if (this.waitingResultNum || this.waitingResponseNum) return false;
        return true;
    }
    /** @remark 等待对方返回的Promise队列的数量 */
    protected get waitingResultNum() {
        return this.#syncReturnQueue.size;
    }
    /** @remark 等待返回给对方的Promise队列的数量 */
    protected get waitingResponseNum() {
        return this.#sendingUniqueKey.size;
    }
}

interface CallOptions {}
interface SetCmdOptions<Fn extends CmdFx> {
    /** 不解析二进制 */
    useRawArg?: boolean;
    /** 参数转换函数 */
    trans?: (args: Parameters<Fn>) => any[];
}

type CmdFx = (...args: any[]) => any;

type CpcCmdList = {
    [key: string | number]: ((...args: any[]) => any) | (() => any);
};

type GetFn<T> = T extends CmdFx ? T : never;
type PickFn<T> = {
    [key in keyof T as T[key] extends (...args: any[]) => any ? key : never]: T[key];
};
type PickVoidFn<T extends object> = {
    [key in keyof T as T[key] extends CmdFx ? (Parameters<T[key]> extends [] ? key : never) : never]: T[key];
};

type GetVoidFn<T> = T extends () => any ? T : never;
type GetCmds<T> = keyof PickFn<T>;
type GetVoidCmds<T extends object> = keyof PickVoidFn<T>;
type GetAnyVoidCmd<T> = T extends CpcCmdList ? string | number : never;

type F_call = [type: FrameType.call | FrameType.exec, args: any[]];
type F_return = [type: FrameType.return, value: any];
type F_throw = [type: FrameType.throw, value: any];
type F_returnAsync = [type: FrameType.returnAsync, id: number];
type F_asyncRes = [type: FrameType.reject | FrameType.resolve, id: number, value: any];
type F_end = [type: FrameType.fin];

/** @public */
export type CpcFrame = F_call | F_asyncRes | F_returnAsync | F_end | F_return | F_throw;
