export function readByUtf8(buf: Uint8Array) {
  let str = "";
  for (let i = 0; i < buf.length; ) {
    let utf8Byte = buf[i];
    if (utf8Byte < 0b10000000) {
      str += String.fromCharCode(utf8Byte);
      i++;
    } else if (utf8Byte < 0b11100000) {
      let code = ((utf8Byte & 0b11111) << 6) + (buf[i + 1] & 0b111111);
      str += String.fromCharCode(code);
      i += 2;
    } else if (utf8Byte < 0b11110000) {
      let code = ((utf8Byte & 0b1111) << 12) + (((buf[i + 1] & 0b111111) << 6) + (buf[i + 2] & 0b111111));
      str += String.fromCharCode(code);
      i += 3;
    } else if (utf8Byte < 0b11111000) {
      let code =
        ((utf8Byte & 0b111) << 18) +
        (((buf[i + 1] & 0b111111) << 12) + (((buf[i + 2] & 0b111111) << 6) + (buf[i + 3] & 0b111111)));
      str += String.fromCharCode(code);
      i += 4;
    } else if (utf8Byte < 0b11111100) {
      let code =
        ((utf8Byte & 0b11) << 24) +
        ((buf[i + 1] & 0b111111) << 18) +
        (((buf[i + 2] & 0b111111) << 12) + ((buf[i + 3] & 0b111111) << 6) + (buf[i + 4] & 0b111111));
      str += String.fromCharCode(code);
      i += 5;
    } else {
      let code =
        ((utf8Byte & 0b1) << 30) +
        ((buf[i + 1] & 0b111111) << 24) +
        ((buf[i + 1] & 0b111111) << 18) +
        (((buf[i + 2] & 0b111111) << 12) + ((buf[i + 3] & 0b111111) << 6) + (buf[i + 4] & 0b111111));
      str += String.fromCharCode(code);
      i += 6;
    }
  }
  return str;
}
export function writeByUtf8(str: string): Uint8Array {
  if (str === "") return new Uint8Array(0);
  let utf8Len = 0;
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
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
    let code = str.charCodeAt(i);
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
