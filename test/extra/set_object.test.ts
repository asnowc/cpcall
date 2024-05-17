import { describe, test, expect, vi, beforeEach } from "vitest";
import { RpcFrame, CpCall } from "cpcall";
import { DataCollector } from "evlib/async";

describe("setObject", function () {
  const { cpc } = createCpc();

  class Abc {
    static cca() {}
    constructor() {}
    cf() {}
    get yi() {
      return () => {};
    }
  }
  class Child extends Abc {
    child() {
      return this.att;
    }
    att = 9;
  }
  beforeEach(() => {
    cpc.clearFn();
  });
  test("setSub", function () {
    cpc.setObject({ abc: { def() {} } });
    const expectSet = new Set(["abc.def"]);
    setEq(cpc.getAllFn(), expectSet);
  });
  test("getter", function () {
    cpc.setObject(new Child());
    const expectSet = new Set(["cf", "yi", "child"]);
    setEq(cpc.getAllFn(), expectSet);
  });
  test("map", function () {
    expect(() => cpc.setObject(new Map())).not.toThrowError();
  });
  test("static", function () {
    cpc.setObject(Child);
    const expectSet = new Set(["cca"]);
    setEq(cpc.getAllFn(), expectSet);
  });
  test("循环引用", function () {
    const sub: any = {
      a: () => {},
    };
    const sub2 = { s: sub };
    sub.s = sub2;
    const root = {
      sub,
      sub2,
    };
    cpc.setObject(root);
    const expectSet = new Set(["sub.a", "sub2.s.a"]);
    setEq(cpc.getAllFn(), expectSet);
  });
});

function createCpc() {
  const onSendFrame = vi.fn();
  let hd = new DataCollector<RpcFrame>();
  let cpc = new CpCall({ frameIter: hd, sendFrame: onSendFrame });
  return { onSendFrame, hd, cpc };
}
function setEq(s1: Iterable<any>, s2: Set<any>) {
  let size: number = 0;
  for (const s of s1) {
    if (!s2.has(s)) throw new Error("不存在 " + s);
    size++;
  }
  expect(size).toBe(s2.size);
}
