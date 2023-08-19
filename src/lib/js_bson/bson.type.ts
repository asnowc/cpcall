export enum DataType {
    void = 0,
    null = 1,
    undefined = 2,
    true = 3,
    false = 4,
    int = 5,
    bigint = 6,
    double = 7,

    objectId = 8,

    arrayBuffer = 9,
    string = 10,
    regExp = 11,
    /** @deprecated 暂不支持*/
    function = 12,
    array = 13,
    map = 14,

    error = 16,
}
export class ObjectId {
    #value: bigint;
    get value() {
        return this.#value;
    }
    constructor(value: bigint | number) {
        if (value < 0) throw new Error("The number cannot be negative");
        if (typeof value === "number") {
            if (value % 1 !== 0) throw new Error("Id must be an integer");
            this.#value = BigInt(value);
        } else this.#value = value;
    }
    valueOf(): bigint {
        return this.#value;
    }
    toString() {
        return this.#value.toString();
    }
}

export const VOID = Symbol("void");
export class UnsupportedDataTypeError extends Error {
    constructor(desc?: string | number) {
        super("Unsupported data type: " + desc);
    }
}
