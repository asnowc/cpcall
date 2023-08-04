export type PromiseHandel<T, J> = {
    resolve(arg: T): void;
    reject(arg: J): void;
};
class PromiseQueue<T, J, extra extends object = {}> extends Array<PromiseHandel<T, J> & extra> {
    get isEmpty() {
        return this.length === 0;
    }

    resolve(arg: T) {
        const handle = this.shift();
        if (!handle) return false;
        handle.resolve(arg);
        return true;
    }
    reject(arg: J) {
        const handle = this.shift();
        if (!handle) return false;
        handle.reject(arg);
        return true;
    }
    rejectAllByClass(Error: new () => any) {
        for (let i = 0; i < this.length; i++) {
            this[i].reject(new Error());
        }
        this.length = 0;
    }
}
export class ResponseQueue<T, J> extends PromiseQueue<T, J> {
    add() {
        return new Promise<T>((resolve, reject) => {
            this.push({ resolve, reject });
        });
    }
}
export class SyncReturnQueue<T extends object = {}> extends PromiseQueue<any, any, T> {
    readonly asyncMap = new Map<number, PromiseHandel<any, any> & T>();
    get hasItem() {
        return this.length || this.asyncMap.size;
    }
    swapInAsyncMap(id: number) {
        const item = this.shift();
        if (!item) return false;
        this.asyncMap.set(id, item);
        return true;
    }
    add(extra: T): Promise<any> {
        return new Promise<T>((resolve, reject) => {
            this.push({ resolve, reject, ...extra });
        });
    }
    takeAsyncItem(id: number) {
        const item = this.asyncMap.get(id);
        this.asyncMap.delete(id);
        return item;
    }

    rejectAsyncAllByClass(error: new () => any) {
        for (const [id, item] of this.asyncMap) {
            item.reject(new error());
        }
        this.asyncMap.clear();
    }
}
