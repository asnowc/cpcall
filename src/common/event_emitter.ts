type EvListener = (...args: any[]) => any;

export class EventEmitter<T extends object = Actions> {
    #listeners = new Map<string | symbol, Set<EvListener>>();
    on<E extends keyof PickFn<T>, Fn extends EvListener = GetFn<T[E]>>(name: E, fn: Fn): Fn;
    on<Fn extends EvListener>(name: string | symbol, fn: Fn): Fn;
    on(name: string | symbol, fn: EvListener) {
        let list = this.#listeners.get(name);
        if (!list) {
            list = new Set();
            this.#listeners.set(name, list);
        }
        list.add(fn);
        return fn;
    }
    off<E extends keyof PickFn<T>>(name: E, fn: Function): void;
    off(name: string | symbol, fn: Function): void;
    off(name: string | symbol, fn: EvListener) {
        this.#listeners.get(name)?.delete(fn);
        return this;
    }
    emit<E extends keyof PickFn<T>, Prams extends any[] = GetPrams<T[E]>>(name: E, ...args: Prams): boolean;
    emit(name: string | symbol, ...args: any[]): boolean;
    emit(name: string | symbol, ...args: any[]) {
        if (name === "error") return this.#emitError(args);

        const listeners = this.#listeners.get(name);
        if (!listeners?.size) return false;

        const errors: any[] = [];
        for (const fn of listeners) {
            try {
                fn.apply(this, args);
            } catch (error) {
                errors.push(error);
            }
        }
        for (let i = 0; i < errors.length; i++) {
            this.#emitError([new EventError(errors[i])]);
        }
        return true;
    }
    #emitError(args: any[]) {
        const listeners = this.#listeners.get("error");
        if (!listeners?.size) return false;

        for (const fn of listeners) {
            try {
                fn.call(this, ...args);
            } catch (error) {}
        }
    }
}

type Actions = {
    [key: string | symbol]: EvListener;
};

type GetPrams<T> = T extends EvListener ? Parameters<T> : never;
type GetFn<T> = T extends EvListener ? T : never;
type PickFn<T> = {
    [key in keyof T as T[key] extends (...args: any[]) => any ? key : never]: T[key];
};

class EventError extends Error {
    constructor(cause: any) {
        super("Listener exception", { cause });
    }
}
