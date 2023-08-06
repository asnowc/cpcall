import { RemoteArray } from "./remote_array.js";
import { RemoteNumber } from "./remote_number.js";

export class RemoteObject {
    #parent?: RemoteObject;
    #key: string | number;
    constructor(key: string | number, parent?: RemoteObject) {
        this.#parent = parent;
        this.#key = key;
    }

    #listener = new Set<ObjectListener>();
    on(fn: ObjectListener) {
        if (typeof fn !== "function") return;
        this.#listener.add(fn);
    }
    off(fn: Function) {
        return this.#listener.delete(fn as any);
    }
    private emit(key: RemoteKey | KeyPath, event: RemoteActionEvent) {
        for (const fn of this.#listener) {
            try {
                fn(key, event);
            } catch (error) {
                //todo
            }
        }
    }
    emitIgnore(key: RemoteKey | KeyPath, event: RemoteActionEvent, ignore?: Function) {
        if (typeof ignore !== "function") return this.emit(key, event);
        for (const fn of this.#listener) {
            if (fn === ignore) continue;
            try {
                fn(key, event);
            } catch (error) {
                //todo
            }
        }
    }

    /** 触发变化 */
    set(keys: RemoteKey | KeyPath, value: any) {
        let node: any = this;
        if (Array.isArray(keys)) {
            let max = keys.length - 1;
            for (let i = 0; i < max; i++) {
                node = node[keys[i]];
                if (node === null || typeof node !== "object") return false;
            }
            keys = keys[max];
        }

        const oldValue = node[keys];
        if (oldValue instanceof RemoteObject) oldValue.#parent = undefined;
        else if (value instanceof RemoteObject) value.#parent = node;

        node[keys] = value;

        // todo: 触发变化
        // this.onSubChange(keys);

        return true;
    }

    /**
     * 本地变化
     * 从顶层向下触发
     */
    protected onChange(event: RemoteActionEvent, key: RemoteKey | KeyPath) {
        const parent = this.#parent;
        parent?.onChange(event, Array.isArray(key) ? [parent.#key, ...key] : [parent.#key, key]);
        this.emit(key, event);
    }
    /** 触发父级 Action */
    protected onCrossChange(action: RAction, value?: any) {
        const event: RemoteActionEvent = { type: action, newValue: value };
        Object.freeze(event);
        this.#parent?.onChange(event, this.#parent.#key);
    }
    /**
     * 将Action应用于目标对象
     * 这不会触发变化
     */
    static executeAction(
        target: Record<string | symbol | number, any>,
        key: string | number,
        event: RemoteActionEvent
    ) {
        const { type: action, newValue } = event;
        const oldValue = target[key];
        switch (action) {
            case RAction.set:
                target[key] = newValue;
                break;
            case RAction.delete:
                delete target[key];
                break;

            case RAction.inc:
                if (oldValue instanceof RemoteNumber)
                    target[key] = new RemoteNumber(oldValue.value + newValue, key, target as any);
                else if (typeof oldValue === "number") target[key] = oldValue + newValue;
                break;
            case RAction.sub:
                if (oldValue instanceof RemoteNumber)
                    target[key] = new RemoteNumber(oldValue.value - newValue, key, target as any);
                else if (typeof oldValue === "number") target[key] = oldValue - newValue;
                break;
            case RAction.dev:
                if (oldValue instanceof RemoteNumber)
                    target[key] = new RemoteNumber(oldValue.value / newValue, key, target as any);
                else if (typeof oldValue === "number") target[key] = oldValue / newValue;
                break;
            case RAction.mul:
                if (oldValue instanceof RemoteNumber)
                    target[key] = new RemoteNumber(oldValue.value * newValue, key, target as any);
                else if (typeof oldValue === "number") target[key] = oldValue * newValue;
                break;

            case RAction.push:
                if (oldValue instanceof RemoteArray) break;
            case RAction.pop:
                break;
            case RAction.shift:
                break;
            case RAction.unshift:
                break;
            case RAction.insert:
                break;
            case RAction.move:
                break;

            case RAction.update:
                break;
            default:
                break;
        }
    }
}

export type RemoteKey = string | number;
export type KeyPath = RemoteKey[];

export interface ObjectListener {
    (key: RemoteKey | KeyPath, action: RemoteActionEvent): void;
}

export interface RemoteActionEvent {
    readonly type: RAction;
    readonly oldValue?: any;
    readonly newValue?: any;
}

export enum RAction {
    call, //k-v     function

    update, //k-v    array/map
    set, //k-v      any
    push, //k-v     array/string
    unshift, //k-v  array/string
    insert, //k-v   array/string

    inc, //k-v      number
    sub, //k-v      number
    mul, //k-v      number
    dev, //k-v      number

    delete, //k     any
    pop, //k        array
    shift, //k      array

    move, //k-k-v   array
}
export type RemoveAction = RAction.delete | RAction.pop | RAction.shift;
export type SetAction =
    | RAction.call
    | RAction.set
    | RAction.push
    | RAction.unshift
    | RAction.insert
    | RAction.inc
    | RAction.sub
    | RAction.mul
    | RAction.dev;
