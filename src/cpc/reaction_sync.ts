import { UniqueKeyMap } from "#rt/common/virtual_heap.js";
import { RAction, ReactionActionEvent, ReactionController, ReactionListener, executeAction } from "./reaction.js";

/**
 * reactionServer change: 通知所有, 无需响应
 * reactionAgent change: 请求server, 暂时修改。
 *      响应不通过：回滚
 *      响应通过：不处理
 */

export class ReactionServerSync {
    /** 分配id，开始监听变化 */
    listen(service: ReactionService, localListener: ReactionListener): ReactionAgent {
        const reaction = service.target;
        let id: number | undefined | null = this.#toIdMap.get(reaction);
        if (id !== undefined) return new ReactionAgent(id); //对象已监听中

        if (this.#idHeap.freeSize === 0) {
            //todo
        }

        let info: ReactionInfo;
        if (typeof reaction === "function") {
            info = reaction as ReactionListener;
        } else {
            const reactionController = ReactionController.get(reaction);
            if (reactionController) {
                info = {
                    localListener,
                    ctrl: reactionController,
                    reaction,
                    remoteReadonly: service.readonly,
                };
                reactionController.addListener(localListener);
            } else info = { reaction };
        }
        id = this.#idHeap.allowKeySet(info);
        this.#toIdMap.set(reaction, id);

        return new ReactionAgent(id, reaction);
    }
    /** agent 触发 Change */
    onRemoteChange(id: number, key: string, action: RAction, data?: any) {
        let info = this.#idHeap.get(id);
        if (info === undefined) return false;
        if (typeof info === "function") {
            info(key, { type: action, newValue: data });
        } else if (info.ctrl) {
            if (info.remoteReadonly) return false;
            info.ctrl.change(key, action, data, info.localListener);
        } else executeAction(info.reaction, key, action, data);
        return true;
    }
    /** agent 取消服务 */
    onRemoteCancel(id: number) {
        if (this.removeListener(id)) this.#idHeap.delete(id);
    }
    cancel(obj: RemoteObj): undefined | [number, () => void] {
        const id = this.#toIdMap.get(obj);
        if (!id) return;
        if (this.removeListener(id)) return [id, () => this.#idHeap.delete(id)];
    }
    private removeListener(id: number) {
        const info = this.#idHeap.get(id);
        if (!info) return;
        if (typeof info === "function") this.#toIdMap.delete(info);
        else {
            this.#toIdMap.delete(info.reaction);
            info.ctrl?.removerListener(info.localListener);
        }
        return true;
    }

    #toIdMap = new Map<RemoteObj, number>();
    #idHeap = new UniqueKeyMap<ReactionInfo>(2 ** 32 - 1);
}
export class ReactionAgentSync {
    /**
     * @param localListener ReactionAgent 本地属性变化时的回调，这个回调应该是发送通知到服务端
     * @param factory 用于创建 Reaction 的工厂函数
     */
    listen(
        agent: ReactionAgent,
        localListener: (key: string, event: ReactionActionEvent) => Promise<void>,
        factory?: ReactionFactory
    ) {
        if (!agent.initObj) {
            return this.#idMap.get(agent.id)!;
        } else {
            const { id, initObj, fnKeys } = agent;

            /** 绑定远程函数 */
            for (let i = 0; i < fnKeys.length; i++) {
                let key = fnKeys[i];
                initObj[key] = function (...args: any[]) {
                    localListener(key, { type: RAction.call, newValue: args });
                };
            }

            //create remoteObject
            let info: ReactionAgentInfo;
            if (factory) {
                info = { reaction: (factory as any)(initObj) };
            } else {
                const controller = new ReactionController(initObj);
                const listener = (key: string | symbol, event: ReactionActionEvent) => {
                    localListener(key as string, event).catch(() => {
                        //todo: rollback
                    });
                };
                info = {
                    ctrl: controller,
                    localListener: listener,
                    reaction: controller.target,
                };
                if (!agent.readonly) controller.addListener(listener!);
            }
            this.#toIdMap.set(info.reaction, id);
            this.#idMap.set(id, info);
            return info.reaction;
        }
    }

    /** 当收到服务端变化时，应该调用这个函数 */
    onRemoteChange(id: number, key: string, action: RAction, data?: any) {
        let info = this.#idMap.get(id);

        if (info === undefined) return false;
        else if (info.ctrl) {
            info.ctrl.change(key, action, data, info.localListener);
        } else executeAction(info.reaction, key, action, data);
        return true;
    }
    /** server 取消服务 */
    onRemoteCancel(id: number) {
        const info = this.#idMap.get(id);
        if (!info) return;
        this.#toIdMap.delete(info.reaction);
        this.#idMap.delete(id);
        info.ctrl?.removerListener(info.localListener);
    }
    cancel(obj: RemoteObj) {
        const id = this.#toIdMap.get(obj);
        if (!id) return;
        this.onRemoteCancel(id);
        return id;
    }

    #toIdMap = new Map<RemoteObj, number>();
    #idMap = new Map<number, ReactionAgentInfo>();
}

export class ReactionAgent {
    readonly readonly?: boolean;
    readonly fnKeys: string[] = [];
    readonly initObj?: RemoteObj;
    constructor(readonly id: number, initObj?: RemoteObj, options?: { readonly?: boolean; fnKeys?: string[] }) {
        this.readonly = options?.readonly;
        if (!initObj) return;
        const obj: RemoteObj = {};
        const kvList = Object.entries(initObj);
        for (let i = 0; i < kvList.length; i++) {
            const [key, value] = kvList[i];
            if (typeof value === "function") this.fnKeys.push(key);
            else obj[key] = value;
        }
        const fnKeys: string[] | undefined = options?.fnKeys;
        if (fnKeys) {
            for (let i = 0; i < fnKeys.length; i++) {
                this.fnKeys.push(fnKeys[i]);
            }
        }
        this.initObj = obj;
    }
}
export class ReactionService {
    constructor(readonly target: object | ReactionListener, readonly readonly?: boolean) {}
}
export function createInvalidReactionIdError(action: string, id: string | number) {
    return new Error(`${action}: invalid reaction id(${id})`);
}

export type ReactionFactory = (init: RemoteObj) => RemoteObj;
export type RemoteObj = Record<string, any>;

/** 本地触发不会变化 */
interface ObjectListener {
    reaction: RemoteObj;
    ctrl?: undefined;
}
interface ReactionObjListener {
    reaction: RemoteObj;
    ctrl: ReactionController;
    /** 监听本地变化的函数 */
    localListener: ReactionListener;
    /** 远程不能更改对象 */
    remoteReadonly?: boolean;
}

type ReactionAgentInfo = ObjectListener | ReactionObjListener;
type ReactionInfo = ReactionAgentInfo | ReactionListener;
