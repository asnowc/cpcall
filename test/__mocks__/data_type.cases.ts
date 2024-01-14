export const baseDataTypes = {
  noContent: [undefined, null, true, false],
  int: [-2147483648, -66, -1, 0, 1, , 2147483647],
  bigint: [-9223372036854775808n, , -1n, 0n, 1n, , 9223372036854775807n],
  double: [-1.1, 1.1, NaN, Infinity, -Infinity],
  string: ["abcd中文123", ""],
  map: [
    { a: 1, b: 2, c: 3 },
    { a: false, b: [1, "a", null] },
    { a: false, b: { a: 9, b: null } },
    { a: 8, b: false, q: [1, 3, "a", null], c: { a: 9 } },
  ],
  array: [
    [1, 4, "2"],
    [undefined, [1, 3, [8, 9], {}, 4]],
  ],
  error: [new Error("abc"), new Error("abc", { cause: 23 })],
  regExp: [/\d+./],
  symbol: [Symbol("abc"), Symbol(""), Symbol()],
};
export const unsupportedData = {
  function: [() => true, function name() {}, function () {}],
};
