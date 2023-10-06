export * from "./errors/type.error.js";
export * from "./errors/validation.error.js";

export class NumericalRangeException extends Error {
    constructor(min?: number, max?: number, valueName = "numerical range") {
        const invalid = valueName + " exception";
        let msg = "";
        if (min === undefined && max !== undefined) msg = `${invalid}: The ${valueName} cannot be greater than ${max}`;
        else if (min !== undefined && max === undefined)
            msg = `${invalid}: The ${valueName} cannot be smaller than ${min}`;
        else if (min === undefined && max === undefined) msg = invalid;
        else msg = `The ${valueName} must be in [${min}, ${max}]`;
        super(msg);
    }
}

export class InvalidIdError extends NumericalRangeException {
    constructor(min?: number, max?: number) {
        super(min, max, "id");
    }
}
export class FrameSizeOvered extends Error {
    constructor(desc?: string | number) {
        super("Frame size overed: " + desc);
    }
}
export class OverLengthError extends Error {
    constructor(name: string, maxLen: number, current: number) {
        let str = `The length of ${name} cannot exceed ${maxLen}`;
        if (current !== undefined) str += `, but the current length is ${current}`;
        super(str);
    }
}
export class BufferDataError extends Error {
    constructor(msg = "Buffer data error") {
        super(msg);
    }
}
