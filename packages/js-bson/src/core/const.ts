/**
 * @public
 * @remarks JBSON 数据类型
 */
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
    /** @internal 暂不支持*/
    function = 12,
    array = 13,
    map = 14,

    error = 16,
    symbol = 17,
}
/** @public */
export class ObjectId {
    #value: bigint;
    /** @remarks ObjectId的原始值 */
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
/**
 * @public
 * @remarks 代表void值，用于写入或响应 array 或 map 的结束标志
 */
export const VOID = Symbol("void");
/**
 * @public
 * @remarks 当读取到一个未知类型的错误
 */
export class UnsupportedDataTypeError extends Error {
    constructor(desc?: string | number) {
        super("Unsupported data type: " + desc);
    }
}
/**
 * @public
 * @remarks 远程发送的异常类型
 */
export class JsBsonError extends Error {}
