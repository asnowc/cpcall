export async function readNumberDLD(read: StreamReader): Promise<bigint> {
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
export function readNumberDLDSync(buffer: Buffer, offset: number): [bigint, number] {
    if (buffer[buffer.byteLength - 1] >> 7 !== 0) throw new Error("buffer 是不完整的DLD数据");
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
export const DLD_MAX_LEN = 0xffffffffffffffn;
const MAX_INT = 0xfffffff;
const shiftList = (() => {
    let list: (number | bigint)[] = [];
    for (let i = 0; i < 5; i++) list[i] = 2 ** (i * 7);
    for (let i = 5; i < 8; i++) list[i] = BigInt(2 ** (i * 7));
    return list;
})();
export function numToDLD(data: number | bigint): Buffer {
    if (data > DLD_MAX_LEN) throw new Error("Exceeds the maximum number");
    else if (data < 0) throw new Error("The number cannot be negative");
    let uInt!: number;
    let bInt: bigint | undefined;

    //如果number类型大于MAX_INT不转成bigInt,则移位运算符可能运算错误
    if (data > MAX_INT) bInt = BigInt(data);
    else uInt = Number(data);
    let buf: number[] = [];

    let isStart = false;
    let i = 7;
    if (bInt) {
        for (; i > 4; i--) {
            if (bInt >= shiftList[i]) {
                buf[i] = 0b10000000 + Number(bInt >> BigInt(i * 7));
                bInt %= shiftList[i] as bigint;
                isStart = true;
            } else if (isStart) buf[i] = 0b10000000;
        }
        if (bInt > MAX_INT) {
            buf[i] = 0b10000000 + Number(bInt >> BigInt(i * 7));
            uInt = Number(bInt % BigInt(shiftList[i]));
            i--;
        } else uInt = Number(bInt);
    }
    for (; i > 0; i--) {
        if (uInt >= shiftList[i]) {
            buf[i] = 0b10000000 + (uInt >>> (i * 7));
            uInt %= shiftList[i] as number;
            isStart = true;
        } else if (isStart) buf[i] = 0b10000000;
    }
    buf[0] = uInt;

    return Buffer.from(buf.reverse());
}

export interface StreamReader {
    (len: number, safe?: false): Promise<Buffer>;
    (len: number, safe: true): Promise<Buffer | null>;
    (len: number, safe?: boolean): Promise<Buffer | null>;
}
export type StreamWriter = (buf: Buffer) => void;

/** 将 StreamWriter 的值保存到数组 */
export class AllListStreamWriter {
    #byteSize = 0;
    get byteSize() {
        return this.#byteSize;
    }
    private bufList: Buffer[] = [];
    write = (buf: Buffer) => {
        if (buf.byteLength <= 0) return;
        this.#byteSize += buf.byteLength;
        this.bufList.push(buf);
    };
    getAll() {
        return Buffer.concat(this.bufList);
    }
}
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
