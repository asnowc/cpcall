import { describe, expect, test as vtTest } from "vitest";
import { cpcTest } from "../env/cpc.env.ts";
import { ExecutionContext, Registrar } from "../../src/cpc/cpc/registrar.ts";

describe("setObject", function () {
  const test = cpcTest;
  class Abc {
    cf() {
      return 11;
    }
    get yi() {
      return () => 20;
    }
  }
  class Child extends Abc {
    child() {
      return this.att;
    }
    att = 9;
  }
  test("setSub", async function ({ cpcSuite }) {
    const { cpc1, cpc2 } = cpcSuite;
    cpc2.setObject({
      abc: {
        def() {
          return 1;
        },
      },
    });
    await expect(cpc1.call("abc.def")).resolves.toBe(1);
  });
  test("getter", async function ({ cpcSuite }) {
    const { cpc1, cpc2 } = cpcSuite;
    cpc2.setObject(new Child());

    await expect(cpc1.call("child"), "method").resolves.toBe(9);
    await expect(cpc1.call("cf"), "extends").resolves.toBe(11);
    await expect(cpc1.call("yi"), "getter").resolves.toBe(20);
  });

  test("循环引用", async function ({ cpcSuite }) {
    const { cpc1, cpc2 } = cpcSuite;

    const root = {
      sub: {} as any,
      sub2: {
        a: () => 1,
      },
    };
    root.sub = root;

    cpc2.setObject(root);

    await expect(cpc1.call("sub.sub.sub.sub2.a")).resolves.toBe(1);
  });
});

describe("重复设置路径", function () {
  const test = cpcTest;
  test("重复设置 root object", function ({ cpcHandle: { cpc } }) {
    cpc.setObject({});
    expect(() => cpc.setObject({})).toThrowError();
  });
  test("重复设置路径", function ({ cpcHandle: { cpc } }) {
    cpc.setObject({ m1() {} }, ["a", "b"]);
    expect(() => cpc.setObject({}, ["a", "b"])).toThrowError();
    expect(() => cpc.setObject({}, ["a"])).toThrowError();
    expect(() => cpc.setObject({}, ["a", "b", "c"])).toThrowError();
  });
});
const registryTest = vtTest.extend<{ registry: Registrar }>({
  registry({}, use) {
    return use(new Registrar());
  },
});
describe(Registrar, function () {
  const test = registryTest;
  test("set root", function ({ registry }) {
    const obj = { m1() {} };
    registry.setObject(obj);
    expect(registry.getServe(["m1"])?.fn).toBe(obj.m1);
  });
  test("set object", function ({ registry }) {
    const obj = {
      m1() {},
      sub: {
        m2() {},
      },
    };
    registry.setObject(obj, ["a", "b"]);

    expect(registry.getServe(["a", "b", "m1"])).toMatchObject({
      fn: obj.m1,
      this: obj,
      meta: {},
    } satisfies ExecutionContext);
    expect(registry.getServe(["a", "b", "sub", "m2"])).toMatchObject({
      fn: obj.sub.m2,
      this: obj.sub,
      meta: {},
    } satisfies ExecutionContext);
  });
  test("删除根", function ({ registry }) {
    registry.setObject({ m1() {} });

    expect(registry.removeServe(["cc"])).toBe(false);
    expect(registry.removeServe([])).toBe(true);
    expect(registry.getServe([])).toBeUndefined();
  });
  test("删", function ({ registry }) {
    registry.setObject({ m1() {} }, ["a", "b"]);

    expect(registry.removeServe(["a"])).toBe(false);
    expect(registry.removeServe(["a", "b"])).toBe(true);
    expect(registry.getServe(["a", "b"])).toBeUndefined();
  });
});
