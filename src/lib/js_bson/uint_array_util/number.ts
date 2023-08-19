export function readBigInt64BE(buf: Uint8Array, offset = 0) {
    const first = buf[offset];
    const last = buf[offset + 7];
    if (first === undefined || last === undefined) throw outOfBufferError();

    //first << 24 可能溢出
    const val = (first << 24) + (buf[++offset] << 16) + (buf[++offset] << 8) + buf[++offset];
    return (BigInt(val) << 32n) + BigInt(buf[++offset] * 2 ** 24 + (buf[++offset] << 16) + (buf[++offset] << 8) + last);
}
export function writeBigInt64BE(buf: Uint8Array, value: bigint, offset = 0) {
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

export function readInt32BE(buf: Uint8Array, offset = 0) {
    const first = buf[offset];
    const last = buf[offset + 3];
    if (first === undefined || last === undefined) throw outOfBufferError();

    //first << 24 可能溢出
    return (first << 24) + buf[++offset] * 2 ** 16 + buf[++offset] * 2 ** 8 + last;
}
export function writeInt32BE(buf: Uint8Array, value: number, offset = 0) {
    buf[offset + 3] = value;
    value = value >>> 8;
    buf[offset + 2] = value;
    value = value >>> 8;
    buf[offset + 1] = value;
    value = value >>> 8;
    buf[offset] = value;
    return offset + 4;
}

/**
 * 浮点
 */

// Temporary buffers to convert numbers.
const float32Array = new Float32Array(1);
const uInt8Float32Array = new Uint8Array(float32Array.buffer);
const float64Array = new Float64Array(1);
const uInt8Float64Array = new Uint8Array(float64Array.buffer);

// Check endianness.
float32Array[0] = -1; // 0xBF800000
// Either it is [0, 0, 128, 191] or [191, 128, 0, 0]. It is not possible to
// check this with `os.endianness()` because that is determined at compile time.
const bigEndian = uInt8Float32Array[3] === 0;
function readDoubleBackwards(buf: Uint8Array, offset = 0) {
    const first = buf[offset];
    const last = buf[offset + 7];
    if (first === undefined || last === undefined) throw outOfBufferError();

    uInt8Float64Array[7] = first;
    uInt8Float64Array[6] = buf[++offset];
    uInt8Float64Array[5] = buf[++offset];
    uInt8Float64Array[4] = buf[++offset];
    uInt8Float64Array[3] = buf[++offset];
    uInt8Float64Array[2] = buf[++offset];
    uInt8Float64Array[1] = buf[++offset];
    uInt8Float64Array[0] = last;
    return float64Array[0];
}
function readDoubleForwards(buf: Uint8Array, offset = 0) {
    const first = buf[offset];
    const last = buf[offset + 7];
    if (first === undefined || last === undefined) throw outOfBufferError();

    uInt8Float64Array[0] = first;
    uInt8Float64Array[1] = buf[++offset];
    uInt8Float64Array[2] = buf[++offset];
    uInt8Float64Array[3] = buf[++offset];
    uInt8Float64Array[4] = buf[++offset];
    uInt8Float64Array[5] = buf[++offset];
    uInt8Float64Array[6] = buf[++offset];
    uInt8Float64Array[7] = last;
    return float64Array[0];
}

function writeDoubleBackwards(buf: Uint8Array, val: number, offset = 0) {
    float64Array[0] = val;
    buf[offset++] = uInt8Float64Array[7];
    buf[offset++] = uInt8Float64Array[6];
    buf[offset++] = uInt8Float64Array[5];
    buf[offset++] = uInt8Float64Array[4];
    buf[offset++] = uInt8Float64Array[3];
    buf[offset++] = uInt8Float64Array[2];
    buf[offset++] = uInt8Float64Array[1];
    buf[offset++] = uInt8Float64Array[0];
    return offset;
}
function writeDoubleForwards(buf: Uint8Array, val: number, offset = 0) {
    float64Array[0] = val;
    buf[offset++] = uInt8Float64Array[0];
    buf[offset++] = uInt8Float64Array[1];
    buf[offset++] = uInt8Float64Array[2];
    buf[offset++] = uInt8Float64Array[3];
    buf[offset++] = uInt8Float64Array[4];
    buf[offset++] = uInt8Float64Array[5];
    buf[offset++] = uInt8Float64Array[6];
    buf[offset++] = uInt8Float64Array[7];
    return offset;
}
// const readFloatLE = bigEndian ? readFloatBackwards : readFloatForwards;
// const readFloatBE = bigEndian ? readFloatForwards : readFloatBackwards;
export const readDoubleLE = bigEndian ? readDoubleBackwards : readDoubleForwards;
export const readDoubleBE = bigEndian ? readDoubleForwards : readDoubleBackwards;
// const writeFloatLE = bigEndian ? writeFloatBackwards : writeFloatForwards;
// const writeFloatBE = bigEndian ? writeFloatForwards : writeFloatBackwards;
export const writeDoubleLE = bigEndian ? writeDoubleBackwards : writeDoubleForwards;
export const writeDoubleBE = bigEndian ? writeDoubleForwards : writeDoubleBackwards;

type int = number;
function outOfBufferError() {
    return new Error("Out of Buffer");
}
