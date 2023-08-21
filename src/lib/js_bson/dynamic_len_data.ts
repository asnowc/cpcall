/** 动态长度BigInt读取 */
function readBigIntCore(desc: int, buf: Uint8Array): [bigint, int] {
    let hi: number;
    let offset: number;
    if (desc > 0b111) {
        offset = 1;
        hi = buf[0] & 0b111;
    } else if (desc > 0b11) {
        offset = 2;
        hi = ((buf[0] & 0b11) << 8) + buf[1];
    } else if (desc > 0b1) {
        offset = 3;
        hi = ((buf[0] & 0b1) << 16) + (buf[1] << 8) + buf[2];
    } else {
        offset = 4;
        hi = (buf[1] << 16) + (buf[2] << 8) + buf[3];
    }
    const len = 4 + offset;
    const lo = buf[offset++] * 2 ** 24 + (buf[offset++] << 16) + (buf[offset++] << 8) + buf[offset];
    return [(BigInt(hi) << 32n) + BigInt(lo), len];
}

/**
 * @public
 * @remark 将二进制动态数据转为数字的类
 */
export class DLD {
    static readonly MAX_INT = Number.MAX_SAFE_INTEGER;
    static readonly MAX_BIG_ING = 0xffffffffffffffn;

    static readNumberSync(buf: Uint8Array, offset = 0): [int, int] {
        if (offset > 0) buf = buf.subarray(offset);

        const desc = 0xff - buf[0];
        if (desc > 0b1111111) return [buf[0] & 0b1111111, 1];
        else if (desc > 0b111111) return [((buf[0] & 0b111111) << 8) + buf[1], 2];
        else if (desc > 0b11111) return [((buf[0] & 0b11111) << 16) + (buf[1] << 8) + buf[2], 3];
        else if (desc > 0b1111) return [((buf[0] & 0b1111) << 24) + (buf[1] << 16) + (buf[2] << 8) + buf[3], 4];

        const res = readBigIntCore(desc, buf);
        if (res[0] > Number.MAX_SAFE_INTEGER) throw new Error("Integer over maximum");
        return [Number(res[0]), res[1]];
    }
    static readBigIntSync(buf: Uint8Array, offset = 0): [bigint, int] {
        if (buf[offset] === 0xff) return [readBigInt64BE(buf, offset), 9];

        if (offset > 0) buf = buf.subarray(offset);
        const desc = 0xff - buf[0];
        if (desc > 0b1111111) return [BigInt(buf[0] & 0b1111111), 1];
        else if (desc > 0b111111) return [BigInt(((buf[0] & 0b111111) << 8) + buf[1]), 2];
        else if (desc > 0b11111) return [BigInt(((buf[0] & 0b11111) << 16) + (buf[1] << 8) + buf[2]), 3];
        else if (desc > 0b1111) return [BigInt(((buf[0] & 0b1111) << 24) + (buf[1] << 16) + (buf[2] << 8) + buf[3]), 4];

        return readBigIntCore(desc, buf);
    }
    //todo: 优化
    static async readBigInt(read: StreamReader, safe?: false): Promise<bigint>;
    static async readBigInt(read: StreamReader, safe?: boolean): Promise<bigint | undefined>;
    static async readBigInt(read: StreamReader, safe?: boolean) {
        const head = await read(1, safe);
        if (!head) return;
        if (head[0] === 0xff) return readBigInt64BE(await read(8), 0);
        const desc = 0xff - head[0];
        if (desc > 0b111_1111) return BigInt(head[0] & 0b1111111);

        let addLen: number;
        if (desc > 0b11_1111) addLen = 1;
        else if (desc > 0b1_1111) addLen = 2;
        else if (desc > 0b1111) addLen = 3;
        else if (desc > 0b111) addLen = 4;
        else if (desc > 0b11) addLen = 5;
        else if (desc > 0b1) addLen = 6;
        else addLen = 7;

        const buf = await read(addLen);
        return this.readBigIntSync(concatUint8Array([head, buf], 1 + addLen))[0];
    }
    static async readNumber(read: StreamReader, safe?: false): Promise<number>;
    static async readNumber(read: StreamReader, safe?: boolean): Promise<number | undefined>;
    static async readNumber(read: StreamReader, safe?: boolean) {
        let bigInt = await this.readBigInt(read, safe);
        if (bigInt === undefined) return;
        if (bigInt > Number.MAX_SAFE_INTEGER) throw new Error("Integer over maximum");
        return Number(bigInt);
    }
}

function bigIntToDLD(value: bigint): Uint8Array {
    if (value < 0x10000000) return numberToDLD(Number(value));
    else if (value >= 0x10000000_00000000) {
        let buf: Uint8Array = new Uint8Array(9);
        writeBigInt64BE(buf, value, 1);
        buf[0] = 0xff;
    }

    let buf: Uint8Array;

    if (value < 0x8_00000000) {
        buf = new Uint8Array(5);
        writeUint32BE(buf, Number(value & 0xffffffffn), 1);
        buf[0] = Number(value >> 32n) + 0b11110000;
    } else if (value < 0x400_00000000) {
        buf = new Uint8Array(6);
        writeUint32BE(buf, Number(value & 0xffffffffn), 2);
        let hi = Number(value >> 32n);
        buf[1] = hi;
        hi >>= 8;
        buf[0] = hi + 0b11111000;
    } else if (value < 0x20000_00000000) {
        buf = new Uint8Array(7);
        writeUint32BE(buf, Number(value & 0xffffffffn), 3);
        let hi = Number(value >> 32n);
        buf[2] = hi;
        hi >>= 8;
        buf[1] = hi;
        hi >>= 8;
        buf[0] = hi + 0b11111100;
    } else {
        buf = new Uint8Array(8);
        writeBigInt64BE(buf, value, 0);
        buf[0] = 0b11111110;
    }

    return buf;
}
function numberToDLD(value: int): Uint8Array {
    let buf: Uint8Array;
    if (value < 0x80) {
        buf = new Uint8Array(1);
        buf[0] = value;
    } else if (value < 0x4000) {
        buf = new Uint8Array(2);
        buf[1] = value;
        value >>= 8;
        buf[0] = value + 0x80;
    } else if (value < 0x200000) {
        buf = new Uint8Array(3);
        buf[2] = value;
        value >>= 8;
        buf[1] = value;
        value >>= 8;
        buf[0] = 0b11000000 + value;
    } else if (value < 0x10000000) {
        buf = new Uint8Array(4);
        buf[3] = value;
        value >>= 8;
        buf[2] = value;
        value >>= 8;
        buf[1] = value;
        value >>= 8;
        buf[0] = 0b11100000 + value;
    } else {
        return bigIntToDLD(BigInt(value));
    }
    return buf;
}
const MAX_INT = 0xffffffff;

/**
 * @public
 * @remark 将整数转为动态二进制数据
 */
export function numToDLD(data: number | bigint): Uint8Array {
    if (data < 0) throw new Error("The number cannot be less than 0");
    if (typeof data === "number") {
        if (data % 1 !== 0) throw new Error("The number must be an integer");
        //超过32位无法使用移位运算符
        if (data > MAX_INT) return bigIntToDLD(BigInt(data));
        else return numberToDLD(data);
    } else if (typeof data !== "bigint") throw new Error("Parameter type error");
    return bigIntToDLD(data);
}

function readBigInt64BE(buf: Uint8Array, offset: int) {
    const first = buf[offset];
    const last = buf[offset + 7];
    if (first === undefined || last === undefined) throw new Error("Out of Buffer");

    let hi = first * 2 ** 24 + (buf[++offset] << 16) + (buf[++offset] << 8) + buf[++offset];
    let lo = buf[++offset] * 2 ** 24 + (buf[++offset] << 16) + (buf[++offset] << 8) + last;
    return BigInt(hi) << (32n + BigInt(lo));
}
function writeBigInt64BE(buf: Uint8Array, value: bigint, offset: int) {
    let lo = Number(value & 0xffffffffn);
    buf[offset + 7] = lo;
    lo = lo >> 8;
    buf[offset + 6] = lo;
    lo = lo >> 8;
    buf[offset + 5] = lo;
    lo = lo >> 8;
    buf[offset + 4] = lo;
    let hi = Number((value >> 32n) & 0xffffffffn);
    buf[offset + 3] = hi;
    hi = hi >> 8;
    buf[offset + 2] = hi;
    hi = hi >> 8;
    buf[offset + 1] = hi;
    hi = hi >> 8;
    buf[offset] = hi;
    return offset + 8;
}
function writeUint32BE(buf: Uint8Array, value: int, offset: int) {
    buf[offset + 3] = value;
    value = value >>> 8;
    buf[offset + 2] = value;
    value = value >>> 8;
    buf[offset + 1] = value;
    value = value >>> 8;
    buf[offset] = value;
    return offset + 4;
}
function concatUint8Array(arr: Uint8Array[], useLen?: int) {
    if (!useLen) {
        useLen = 0;
        for (let i = 0; i < arr.length; i++) useLen += arr[i].length;
    }
    const buf = new Uint8Array(useLen);
    let offset = 0;
    for (let i = 0; i < arr.length; i++) {
        buf.set(arr[i], offset);
        offset += arr[i].byteLength;
    }
    return buf;
}

/** @public */
export interface StreamReader {
    (len: number, safe?: false): Promise<Uint8Array>;
    (len: number, safe: true): Promise<Uint8Array | null>;
    (len: number, safe?: boolean): Promise<Uint8Array | null>;
}
type int = number;
