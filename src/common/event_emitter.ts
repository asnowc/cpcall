type EventListener = (...args: any[]) => void;

export class EventEmitter {
    #listeners = new Map<string | symbol, Set<EventListener>>();
    #listenError = new Set<EventListener>();
    on(name: string | symbol, fn: EventListener) {
        if (name === "error") this.#listenError.add(fn);
        else {
            let list = this.#listeners.get(name);
            if (!list) {
                list = new Set();
                this.#listeners.set(name, list);
            }
            list.add(fn);
        }
        return this;
    }
    off(name: string | symbol, fn: Function): void;
    off(name: string | symbol, fn: EventListener) {
        if (name === "error") this.#listenError.delete(fn);
        else this.#listeners.get(name)?.delete(fn);
        return this;
    }
    emit(name: string | symbol, ...args: any[]) {
        if (name === "error") {
            if (this.#listenError.size === 0) return false;
            this.#emitError(...args);
            return true;
        }
        const listeners = this.#listeners.get(name);
        if (!listeners?.size) return false;
        const errors: any[] = [];
        for (const fn of listeners) {
            try {
                fn.call(this, args);
            } catch (error) {
                errors.push(error);
            }
        }
        for (let i = 0; i < errors.length; i++) {
            this.#emitError(new EventError(errors[i]));
        }
        return true;
    }
    #emitError(...args: any[]) {
        for (const fn of this.#listenError) {
            try {
                fn.call(this, ...args);
            } catch (error) {}
        }
    }
}

class EventError extends Error {
    constructor(cause: any) {
        super("Listener exception", { cause });
    }
}
