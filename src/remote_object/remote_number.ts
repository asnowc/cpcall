import { RAction, RemoteObject } from "./remote_object.js";

export class RemoteNumber extends RemoteObject {
    #value;
    get value() {
        return this.#value;
    }

    constructor(value: number, key: string | number, parent?: RemoteObject) {
        super(key, parent);
        this.#value = value;
    }
    plus(value: number) {
        this.#value += value;
        this.onCrossChange(RAction.inc, value);
    }
    subtract(value: number) {
        this.#value -= value;
        this.onCrossChange(RAction.sub, value);
    }
    multiply(value: number) {
        this.#value *= value;
        this.onCrossChange(RAction.mul, value);
    }
    divide(value: number) {
        this.#value /= value;
        this.onCrossChange(RAction.dev, value);
    }
    valueOf(): number {
        return this.#value;
    }
    toString(): string {
        return this.#value.toString();
    }
}
