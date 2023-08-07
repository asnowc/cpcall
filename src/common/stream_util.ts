export class DLD {
    static readonly MAX_INT = Number.MAX_SAFE_INTEGER;
    static readonly MAX_BIG_ING = 0xffffffffffffffn;
    static readNumberSync(buffer: Buffer, offset: number = 0) {
        let [bigInt, len] = this.readBigIntSync(buffer, offset);
        if (bigInt > Number.MAX_SAFE_INTEGER) throw new Error("Integer over maximum");
        return [Number(bigInt), len];
    }
    static readBigIntSync(buffer: Buffer, offset: number = 0): [bigint, number] {
        let data = 0n;
        let byteSize = 1;
        do {
            let rawData = BigInt(buffer[offset]);
            if (rawData > 0b1111111) {
                data = (data << 7n) + rawData - 0b10000000n;
            } else {
                data = (data << 7n) + rawData;
                break;
            }
            offset++;
            byteSize++;
            if (byteSize > 8) throw new Error("错误的DLD数据");
        } while (true);

        return [data, byteSize];
    }
    static async readBigInt(read: StreamReader) {
        let data = 0n;
        do {
            let buf = await read(1);

            let rawData = BigInt(buf.readUint8());
            if (rawData > 0b1111111) {
                data = (data << 7n) + rawData - 0b10000000n;
            } else {
                return (data << 7n) + rawData;
            }
        } while (true);
    }
    static async readNumber(read: StreamReader) {
        let bigInt = await this.readBigInt(read);
        if (bigInt > Number.MAX_SAFE_INTEGER) throw new Error("Integer over maximum");
        return Number(bigInt);
    }
    static async read(read: StreamReader): Promise<Buffer> {
        let list: number[] = [];
        do {
            let buf = await read(1);
            let rawData = buf.readUint8();
            if (rawData > 0b1111111) list.push(rawData);
            else break;
        } while (true);

        let mv = 0x10;
        for (let i = list.length; i > 0; i--) {
            list[i] += list[i - 1] % mv;
            list[i - 1] >> mv;
            mv << 1;
        }
        return Buffer.from(list);
    }
}

const MAX_INT = 0xffffffff;
function bigIntToDLD(value: bigint): Buffer {
    let list: number[] = [];
    list[0] = Number(value % 0x80n);
    value >>= 7n;

    while (value > 0x7f) {
        list.unshift(Number(value % 0x80n | 0x80n));
        value >>= 7n;
    }
    if (value > 0) list.unshift(Number(value | 0x80n));
    return Buffer.from(list);
}
function numberToDLD(value: number) {
    let list: number[] = [];
    list[0] = value % 0x80;
    value >>>= 7;

    while (value > 0x7f) {
        list.unshift(value % 0x80 | 0x80);
        value >>>= 7;
    }
    if (value > 0) list.unshift(value | 0x80);
    return Buffer.from(list);
}
export function numToDLD(data: number | bigint): Buffer {
    if (data < 0) throw new Error("The number cannot be negative");
    if (typeof data === "number") {
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

/** 固定 Buffer 的 StreamReader*/
export function createFixedStreamReader(buffer: Buffer) {
    let offset = 0;
    return async function streamReader(size: number) {
        let end = offset + size;
        if (end > buffer.length) throw new Error("out of range");
        let buf = buffer.subarray(offset, end);
        offset = end;
        return buf;
    };
}
