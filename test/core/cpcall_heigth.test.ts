import { describe, test, expect, vi, beforeEach } from "vitest";
import { RpcFrame, CpCall } from "cpcall";
import { PassiveDataCollector } from "evlib/async";

interface SubCall {
  ab: number;
  cd(a: string, b?: boolean): number;
  ef(): void;
}
interface TopCall {
  ab: number;
  sub: SubCall;
  cd(a: string, b?: boolean): number;
}

describe("genCaller", function () {
  const { cpc } = createCpc();
  const mockCaller = {
    call: vi.fn(),
  };
  (cpc as any).caller = mockCaller;

  beforeEach(() => {
    mockCaller.call.mockReset();
  });
  test("setSub", function () {
    cpc.setObject({ abc: { def() {} } });
    const expectSet = new Set(["abc.def"]);
    setEq(cpc.getAllFn(), expectSet);
  });
  test("空调用", async function () {
    const caller = cpc.genCaller<TopCall>();
    expect(caller).toThrowError();
  });
  test("顶级调用", async function () {
    const caller = cpc.genCaller<TopCall>();
    caller.cd("a", true);
    expect(mockCaller.call).toBeCalledWith("cd", "a", true);
  });
  test("子集调用", async function () {
    const caller = cpc.genCaller<TopCall>();
    caller.sub.ef();
    expect(mockCaller.call).toBeCalledWith("sub.ef");
  });
  describe("修改属性", function () {
    test("修改属性", function () {
      const caller = cpc.genCaller(undefined, { keepThen: true });
      caller.att1 = 1 as any;
      expect(Object.keys(caller)).toEqual(["att1"]);
      expect(caller.att1).toBe(1);
      delete caller.att1;
    });
    test("异步函数中传递", async function () {
      expect(cpc.genCaller().then).toBeNull();
    });
  });
}, 500);
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
});
function createCpc() {
  const onSendFrame = vi.fn();
  let hd = new PassiveDataCollector<RpcFrame>();
  let cpc = new CpCall(hd.getAsyncGen(), onSendFrame);
  return { onSendFrame, hd, cpc };
}
function setEq(s1: Iterable<any>, s2: Set<any>) {
  let size: number = 0;
  for (const s of s1) {
    if (!s2.has(s)) throw new Error("不存在 " + s);
    size++;
  }
  if (size !== s2.size) throw new Error("长度不一致");
}
