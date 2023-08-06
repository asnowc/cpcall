import { RAction, RemoteObject } from "./remote_object.js";

export class RemoteArray<T> extends RemoteObject {
    private array: T[] = [];
    at(index: number) {
        return this.array[index];
    }
    reset(data: T[]) {
        this.array = [...data];
        this.onCrossChange(RAction.set, data);
    }

    pop() {
        this.onCrossChange(RAction.pop);
        return this.array.pop();
    }
    shift() {
        this.onCrossChange(RAction.shift);
        return this.array.shift();
    }
    push(item: T): number {
        this.onCrossChange(RAction.push, item);
        return this.array.push(item);
    }
    unshift(item: T): number {
        this.onCrossChange(RAction.unshift, item);
        return this.array.unshift(item);
    }
    move(form: number, to: number) {
        if (form === to) return;
        const array = this.array;
        if (form < 0 || to < 0 || form >= array.length || to >= array.length)
            throw new Error("The index must be within the length range of the array");

        this.onCrossChange(RAction.move, [form, to]);

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

        this.onCrossChange(RAction.move, [at, value]);

        for (let i = array.length; i > at; i++) array[i] = array[i - 1];
        array[at] = value;
    }
    [Symbol.iterator]() {
        return this.array[Symbol.iterator]();
    }
}
export interface ReactionAgent<T> extends RemoteObject {
    set(index: number, value: T): boolean;
}
