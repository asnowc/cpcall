class SubService {
  mul(a: number, b: number) {
    return a * b;
  }
}
export class ServerService {
  sub = new SubService();
  calc(a: number, b: number) {
    return a + b;
  }
  getData() {
    return {
      regExp: /abc/,
      map: new Map([
        [1, 2],
        [3, 4],
      ]),
      set: new Set([1, 2, 3, 4]),
    };
  }
}
