export class DLD {
    static readonly MAX_INT = Number.MAX_SAFE_INTEGER;
    static readonly MAX_BIG_ING = 0xffffffffffffffn;

    private static readBigIntCore(desc: number, buf: Buffer): [bigint, number] {
        let nBuf = Buffer.alloc(8);
        if (desc > 0b111) {
            buf.copy(nBuf, 3, 0, 5);
            nBuf[3] = buf[0] & 0b111;
            return [nBuf.readBigUInt64BE(), 5];
        } else if (desc > 0b11) {
            buf.copy(nBuf, 2, 0, 6);
            nBuf[2] = buf[0] & 0b11;
            return [nBuf.readBigUInt64BE(), 6];
        } else if (desc > 0b1) {
            buf.copy(nBuf, 1, 0, 7);
            nBuf[1] = buf[0] & 0b1;
            return [nBuf.readBigUInt64BE(), 7];
        } else {
            buf.copy(nBuf, 1, 1, 8);
            return [nBuf.readBigUInt64BE(), 8];
        }
    }
    static readNumberSync(buf: Buffer, offset = 0): [number, number] {
        if (offset > 0) buf = buf.subarray(offset);

        const desc = 0xff - buf[0];
        if (desc > 0b1111111) return [buf[0] & 0b1111111, 1];
        else if (desc > 0b111111) return [((buf[0] & 0b111111) << 8) + buf[1], 2];
        else if (desc > 0b11111) return [((buf[0] & 0b11111) << 16) + buf.readUint16BE(1), 3];
        else if (desc > 0b1111) return [((buf[0] & 0b1111) << 24) + (buf[1] << 16) + buf.readUint16BE(2), 4];

        const res = this.readBigIntCore(desc, buf);
        if (res[0] > Number.MAX_SAFE_INTEGER) throw new Error("Integer over maximum");
        return [Number(res[0]), res[1]];
    }
    static readBigIntSync(buf: Buffer, offset = 0): [bigint, number] {
        if (offset > 0) buf = buf.subarray(offset);

        if (buf[0] === 0xff) return [buf.readBigUInt64BE(1), 9];
        const desc = 0xff - buf[0];
        if (desc > 0b1111111) return [BigInt(buf[0] & 0b1111111), 1];
        else if (desc > 0b111111) return [BigInt(((buf[0] & 0b111111) << 8) + buf[1]), 2];
        else if (desc > 0b11111) return [BigInt(((buf[0] & 0b11111) << 16) + buf.readUint16BE(1)), 3];
        else if (desc > 0b1111) return [BigInt(((buf[0] & 0b1111) << 24) + (buf[1] << 16) + buf.readUint16BE(2)), 4];

        return this.readBigIntCore(desc, buf);
    }
    //todo: 优化
    static async readBigInt(read: StreamReader, safe?: false): Promise<bigint>;
    static async readBigInt(read: StreamReader, safe?: boolean): Promise<bigint | undefined>;
    static async readBigInt(read: StreamReader, safe?: boolean) {
        const head = await read(1, safe);
        if (!head) return;
        if (head[0] === 0xff) return (await read(8)).readBigInt64BE();
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
        return this.readBigIntSync(Buffer.concat([head, buf]))[0];
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

function bigIntToDLD(value: bigint): Buffer {
    if (value < 0x10000000) return numberToDLD(Number(value));
    else if (value >= 0x10000000_00000000) {
        let buf: Buffer = Buffer.alloc(9);
        buf.writeBigInt64BE(value, 1);
        buf[0] = 0xff;
    }

    let buf: Buffer = Buffer.alloc(8);
    buf.writeBigInt64BE(value);

    if (value < 0x8_00000000) (buf[3] += 0b11110000), (buf = buf.subarray(3)); //5B
    else if (value < 0x400_00000000) (buf[2] += 0b11111000), (buf = buf.subarray(2));
    else if (value < 0x20000_00000000) (buf[1] += 0b11111100), (buf = buf.subarray(1));
    else buf[0] = 0b11111110;

    return buf;
}
function numberToDLD(value: number) {
    let buf: Buffer;
    if (value < 0x80) {
        buf = Buffer.allocUnsafe(1);
        buf[0] = value;
    } else if (value < 0x4000) {
        buf = Buffer.allocUnsafe(2);
        buf.writeUint16BE(value);
        buf[0] += 0b10000000;
    } else if (value < 0x200000) {
        buf = Buffer.allocUnsafe(3);
        buf.writeUint16BE(value & 0xffff, 1);
        buf[0] = 0b11000000 + (value >>> 16);
    } else if (value < 0x10000000) {
        buf = Buffer.allocUnsafe(4);
        buf.writeUint32BE(value);
        buf[0] += 0b11100000;
    } else {
        return bigIntToDLD(BigInt(value));
    }
    return buf;
}
const MAX_INT = 0xffffffff;
export function numToDLD(data: number | bigint): Buffer {
    if (data < 0) throw new Error("The number cannot be negative");
    if (typeof data === "number") {
        //超过32位无法使用移位运算符
        if (data > MAX_INT) return bigIntToDLD(BigInt(data));
        else return numberToDLD(data);
    } else if (typeof data !== "bigint") throw new Error("Parameter type error");
    return bigIntToDLD(data);
}

export interface StreamReader {
    (len: number, safe?: false): Promise<Buffer>;
    (len: number, safe: true): Promise<Buffer | null>;
    (len: number, safe?: boolean): Promise<Buffer | null>;
}
export type StreamWriter = (buf: Buffer) => void;
