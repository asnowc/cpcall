import { ByteParser } from "evlib/async";

export class U32DByteParser extends ByteParser<number> {
  value = 0;
  next(buf: Uint8Array): boolean {
    let max = buf.byteLength;
    let next: number;
    let byteLen = 0;
    do {
      next = buf[byteLen];
      this.value += (next & 0b0111_1111) << (7 * byteLen);
      if (++byteLen > max) {
        return false;
      }
    } while (next > 0b0111_1111);
    this.result = { value: this.value, residue: byteLen < max ? buf.subarray(byteLen) : undefined };
    this.value = 0;
    return true;
  }
}
