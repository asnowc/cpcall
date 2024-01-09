/**
 * 这个库本意是不依赖非 JavaScript 标准就接口。
 * 但是这个字符串编码速度太慢。。。
 * 所以这里检测 TextDecoder 和 TextEncoder 接口是否支持
 */

export function readByUtf8(buf: Uint8Array) {
  let str = "";
  let code: number;
  for (let i = 0; i < buf.length; ) {
    let utf8Byte = buf[i];
    if (utf8Byte < 0b10000000) {
      code = utf8Byte;
      i++;
    } else if (utf8Byte < 0b11100000) {
      code = ((utf8Byte & 0b11111) << 6) + (buf[i + 1] & 0b111111);
      i += 2;
    } else if (utf8Byte < 0b11110000) {
      code = ((utf8Byte & 0b1111) << 12) + (((buf[i + 1] & 0b111111) << 6) + (buf[i + 2] & 0b111111));
      i += 3;
    } else if (utf8Byte < 0b11111000) {
      code =
        ((utf8Byte & 0b111) << 18) +
        (((buf[i + 1] & 0b111111) << 12) + (((buf[i + 2] & 0b111111) << 6) + (buf[i + 3] & 0b111111)));
      i += 4;
    } else if (utf8Byte < 0b11111100) {
      code =
        ((utf8Byte & 0b11) << 24) +
        ((buf[i + 1] & 0b111111) << 18) +
        (((buf[i + 2] & 0b111111) << 12) + ((buf[i + 3] & 0b111111) << 6) + (buf[i + 4] & 0b111111));
      i += 5;
    } else {
      code =
        ((utf8Byte & 0b1) << 30) +
        ((buf[i + 1] & 0b111111) << 24) +
        ((buf[i + 1] & 0b111111) << 18) +
        (((buf[i + 2] & 0b111111) << 12) + ((buf[i + 3] & 0b111111) << 6) + (buf[i + 4] & 0b111111));
      i += 6;
    }
    str += String.fromCharCode(code); //Very slow
  }
  return str;
}
export function writeByUtf8(str: string): Uint8Array {
  if (str === "") return new Uint8Array(0);
  let utf8Len = 0;
  let code: number;
  for (let i = 0; i < str.length; i++) {
    code = str.charCodeAt(i);
    if (code < 0x80) utf8Len++;
    else if (code < 0x8_00) utf8Len += 2;
    else if (code < 0x10000) utf8Len += 3;
    else if (code < 0x200000) utf8Len += 4;
    else if (code < 0x4000000) utf8Len += 5;
    else utf8Len += 6;
  }

  const buf = new Uint8Array(utf8Len);
  let offset = 0;
  for (let i = 0; i < str.length; i++) {
    code = str.charCodeAt(i);
    if (code < 0x80) buf[offset++] = code;
    else if (code < 0x8_00) {
      buf[offset + 1] = 0b10000000 + (code & 0b111111);
      code >>= 6;
      buf[offset] = 0b11000000 + code;
      offset += 2;
    } else if (code < 0x10000) {
      buf[offset + 2] = 0b10000000 + (code & 0b111111);
      code >>= 6;
      buf[offset + 1] = 0b10000000 + (code & 0b111111);
      code >>= 6;
      buf[offset] = 0b11100000 + code;
      offset += 3;
    } else if (code < 0x200000) {
      buf[offset + 3] = 0b10000000 + (code & 0b111111);
      code >>= 6;
      buf[offset + 2] = 0b10000000 + (code & 0b111111);
      code >>= 6;
      buf[offset + 1] = 0b10000000 + (code & 0b111111);
      code >>= 6;
      buf[offset] = 0b11110000 + code;
      offset += 4;
    } else if (code < 0x4000000) {
      buf[offset + 4] = 0b10000000 + (code & 0b111111);
      code >>= 6;
      buf[offset + 3] = 0b10000000 + (code & 0b111111);
      code >>= 6;
      buf[offset + 2] = 0b10000000 + (code & 0b111111);
      code >>= 6;
      buf[offset + 1] = 0b10000000 + (code & 0b111111);
      code >>= 6;
      buf[offset] = 0b11111000 + code;
      offset += 5;
    } else {
      buf[offset + 5] = 0b10000000 + (code & 0b111111);
      code >>= 6;
      buf[offset + 4] = 0b10000000 + (code & 0b111111);
      code >>= 6;
      buf[offset + 3] = 0b10000000 + (code & 0b111111);
      code >>= 6;
      buf[offset + 2] = 0b10000000 + (code & 0b111111);
      code >>= 6;
      buf[offset + 1] = 0b10000000 + (code & 0b111111);
      code >>= 6;
      buf[offset] = 0b11111100 + code;
      offset += 6;
    }
  }
  return buf;
}

export const decodeUtf8 = (function () {
  const TextDecoder = (globalThis as any).TextDecoder;
  if (TextDecoder) {
    const textDecoder = new TextDecoder();
    return (buf: Uint8Array) => textDecoder.decode(buf);
  } else return readByUtf8;
})();
export const encodeUtf8 = (function () {
  const TextEncoder = (globalThis as any).TextEncoder;
  if (TextEncoder) {
    const textEncoder = new TextEncoder();
    return (str: string) => textEncoder.encode(str);
  } else return writeByUtf8;
})();
