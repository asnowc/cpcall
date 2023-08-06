import { Cpc } from "../cpc/cpc.js";
import { ObjectListener, RemoteObject, RemoteActionEvent, RemoteKey, KeyPath } from "./remote_object.js";

export class RemoteRoot extends RemoteObject {
    #onChange?: ObjectListener;
    #onDispose?: (id: number) => void;
    #root?: Cpc;
    constructor(key: number, root: Cpc, option?: { readonly?: boolean }) {
        super(key);
        this.#root = root;
    }
    dispose() {
        this.#onDispose?.(this.key);
        this.#onDispose = undefined;
        this.#onChange = undefined;
        this.#root = undefined;
    }
    get disposed() {
        return Boolean(this.#onDispose);
    }

    /**
     * 远程变化
     * 仅触发最终节点
     */
    sync(actionEvent: RemoteActionEvent, keys: RemoteKey | KeyPath) {
        if (!Array.isArray(keys)) {
            this.emitIgnore(keys, actionEvent, this.#onChange);
            return;
        }
        let node: any = this;
        const max = keys.length - 1;
        for (let i = 0; i < max; i++) {
            node = node[keys[i]];
            if (typeof node !== "object" || node === null) return;
        }
        if (node instanceof RemoteObject) node.emitIgnore(keys[max], actionEvent, this.#onChange);
        else RemoteObject.executeAction(node, keys[max], actionEvent);
    }
}

export interface RemoteRoot {
    get key(): number;
}
