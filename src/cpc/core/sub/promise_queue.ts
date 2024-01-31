import { WithPromise, withPromise } from "evlib";

export class ReturnQueue<T extends {} = {}> {
  readonly syncQueue: WithPromise<T>[] = [];
  readonly asyncMap = new Map<number, WithPromise<T>>();
  get size() {
    return this.syncQueue.length + this.asyncMap.size;
  }
  asyncIdExist(id: number) {
    return this.asyncMap.has(id);
  }
  swapInAsyncMap(id: number) {
    const item = this.syncQueue.shift();
    if (!item) return false;
    this.asyncMap.set(id, item);
    return true;
  }
  add(extra: T): Promise<any> {
    const item = withPromise<T>(extra);
    this.syncQueue.push(item);
    return item.promise;
  }
  shift() {
    return this.syncQueue.shift();
  }
  takeAsyncItem(id: number) {
    const item = this.asyncMap.get(id);
    this.asyncMap.delete(id);
    return item;
  }
  rejectSyncAll(reason: any) {
    for (let i = 0; i < this.syncQueue.length; i++) {
      this.syncQueue[i].reject(reason);
    }
    this.syncQueue.length = 0;
  }
  rejectAsyncAll(reason: any) {
    for (const [id, item] of this.asyncMap) {
      item.reject(reason);
    }
    this.asyncMap.clear();
  }
}
