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

export interface ReactionActionEvent {
    type: RAction;
    oldValue?: any;
    newValue?: any;
}
export interface ReactionListener {
    (key: string | symbol, action: ReactionActionEvent): void;
}
export class ReactionController<T extends Object = Object> {
    constructor(object: T) {
        let newObject = this.initSource(object);
        this.source = newObject;
        this.target = new Proxy(newObject, new ReactionController.ReactionProxyHandler(this)) as T;
        ReactionController.#reactions.set(this.target, this);
    }
    private initSource<T extends object>(obj: T): T {
        if (Array.isArray(obj)) {
            for (let i = 0; i < obj.length; i++) {}
        } else {
            const newObject: Record<string | symbol, any> = {};
            for (const [key, value] of Object.entries(obj)) newObject[key] = value;
            return newObject as T;
        }
    }
    private source: T;
    readonly target: T;
    #listeners = new Set<Function>();
    addListener(fn: ReactionListener) {
        if (typeof fn !== "function") throw new Error("fn must be a function");
        this.#listeners.add(fn);
    }
    removerListener(fn: Function) {
        this.#listeners.delete(fn);
    }

    /**
     * @description  触发变更通知，并根据 action 类型更改 reaction 的值
     * @param key 变更的key
     * @param action ReactionActionEvent
     * @param ignore 要忽略通知的 listener
     */
    change(key: string | symbol, action: RAction, newValue?: any, ignore?: Function) {
        const source: Record<string | symbol, any> = this.source;
        const oldValue = source[key];
        executeAction(source, key, action, newValue);
        this.dispatchChange(key, { type: action, newValue, oldValue }, ignore);
    }
    /** @description 仅触发变更通知 */
    dispatchChange(key: string | symbol, action: ReactionActionEvent, ignore?: Function) {
        if (this.#listeners.size === 0) return false;
        action = Object.freeze({ ...action });
        for (const listener of this.#listeners) {
            if (listener === ignore) continue;
            try {
                (listener as ReactionListener).call(this.target, key, action);
            } catch (error) {}
        }
        return true;
    }

    static get(reaction: Object) {
        return this.#reactions.get(reaction);
    }
    /**
     * 深度拷贝init，创建Reaction, 不支持循环引用
     */
    static create<T extends Object>(init: T): T {
        const controller = new this(init);
        return controller.target;
    }
    static #reactions = new WeakMap<Object, ReactionController>();
    static isReaction(obj: any) {
        return this.#reactions.has(obj);
    }
    private static ReactionProxyHandler = class ReactionProxyHandler implements ProxyHandler<Object> {
        constructor(private reactionController: ReactionController) {}
        set(target: Record<string | symbol, any>, p: string | symbol, newValue: any, receiver: any): boolean {
            const oldValue = target[p];
            if (oldValue === target) return true;

            target[p] = newValue;
            this.reactionController.dispatchChange(p, { type: RAction.set, newValue, oldValue });
            return true;
        }
        defineProperty(): boolean {
            return false;
        }
        deleteProperty(target: Record<string | symbol, any>, p: string | symbol): boolean {
            const oldValue = target[p];
            if (delete target[p]) {
                this.reactionController.dispatchChange(p, { type: RAction.delete, oldValue });
                return true;
            }
            return false;
        }
    };
}

abstract class ReactionItem {
    constructor(readonly key: string, private ctrl?: ReactionController) {}
    protected change(action: RAction, newValue?: any) {
        this.ctrl?.change(this.key, action, newValue);
    }
    dispose() {
        let ctrl = this.ctrl;
        this.ctrl = undefined;
        return ctrl;
    }
}

export class ReactiveNumber extends ReactionItem {
    #value;
    get value() {
        return this.#value;
    }
    constructor(key: string, value: number, ctrl?: ReactionController) {
        super(key, ctrl);
        this.#value = value;
    }
    plus(value: number) {
        this.#value += value;
        this.change(RAction.inc, value);
    }
    subtract(value: number) {
        this.#value -= value;
        this.change(RAction.sub, value);
    }
    multiply(value: number) {
        this.#value *= value;
        this.change(RAction.mul, value);
    }
    divide(value: number) {
        this.#value /= value;
        this.change(RAction.dev, value);
    }
    valueOf(): number {
        return this.#value;
    }
    toString(): string {
        return this.#value.toString();
    }
    toNew(value: number) {
        const [key, ctrl] = this.dispose();
        return new ReactiveNumber(key, value, ctrl);
    }
}

export class ReactiveArray<T> extends ReactionItem {
    constructor(key: string, ctrl?: ReactionController, initValue?: T[]) {
        super(key, ctrl);
        if (initValue) {
            for (let i = 0; i < initValue.length; i++) {
                this.array[i] = initValue[i];
            }
        }
    }
    readonly array: T[] = [];
    set(index: number, value: T) {
        this.change(RAction.update, [index, value]);
        return (this.array[index] = value);
    }
    push(item: T): number {
        this.change(RAction.push, item);
        return this.array.push(item);
    }
    pop() {
        this.change(RAction.pop);
        return this.array.pop();
    }
    shift() {
        this.change(RAction.shift);
        return this.array.shift();
    }
    unshift(item: T): number {
        this.change(RAction.unshift, item);
        return this.array.unshift(item);
    }
    move(form: number, to: number) {
        if (form === to) return;
        const array = this.array;
        if (form < 0 || to < 0 || form >= array.length || to >= array.length)
            throw new Error("The index must be within the length range of the array");

        this.change(RAction.move, [form, to]);

        let add = form < to ? 1 : -1;
        let fromValue = array[form];
        while (form < to) {
            array[form] = array[form + add];
            form += add;
        }
        array[to] = fromValue;
    }
    insertAt(value: T, at: number) {
        const array = this.array;
        if (at < 0) at = array.length + (at % array.length);

        this.change(RAction.move, [value, at]);

        for (let i = array.length; i > at; i++) array[i] = array[i - 1];
        array[at] = value;
    }
}
export function executeAction(
    target: Record<string | symbol, any>,
    key: string | symbol,
    action: RAction,
    newValue?: any
) {
    const oldValue = target[key];
    switch (action) {
        case RAction.set:
            target[key] = newValue;
            break;
        case RAction.delete:
            delete target[key];
            break;

        case RAction.inc:
            if (oldValue instanceof ReactiveNumber) target[key] = oldValue.toNew(oldValue.value + 1);
            else if (typeof oldValue === "number") target[key] = oldValue + 1;
            break;
        case RAction.sub:
            if (oldValue instanceof ReactiveNumber) target[key] = oldValue.toNew(oldValue.value - 1);
            else if (typeof oldValue === "number") target[key] = oldValue - 1;
            break;
        case RAction.dev:
            if (oldValue instanceof ReactiveNumber) target[key] = oldValue.toNew(oldValue.value / 1);
            else if (typeof oldValue === "number") target[key] = oldValue / 1;
            break;
        case RAction.mul:
            if (oldValue instanceof ReactiveNumber) target[key] = oldValue.toNew(oldValue.value * 1);
            else if (typeof oldValue === "number") target[key] = oldValue * 1;
            break;

        case RAction.push:
            if (oldValue instanceof ReactiveArray) break;
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

export function needRollbackAction(action: ReactionActionEvent): ReactionActionEvent | undefined {
    const type = action.type;
    if (action.type === RAction.call) return;
    //todo
}
export function rollbackAction(ctrl: ReactionController, key: string | symbol, action: ReactionActionEvent) {}
