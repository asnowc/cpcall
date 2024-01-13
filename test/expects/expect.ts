import { Assertion, AsymmetricMatchersContaining } from "vitest";
import { expect } from "vitest";
import { JbodError } from "jbod";

interface CustomMatchers<R = unknown> {
  isJbodSymbol(num: number): R;
  isJbodMap(val: Object): R;
  isJbodArray(val: any[]): R;
  isJbodRegExp(val: RegExp): R;
  isJbodArrayBuffer(val: ArrayBuffer): R;
  isJbodError(val: Error): R;
  /** 断言是由原始值转换而来 */
  jbodEqual(val: any): R;
}

declare module "vitest" {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
expect.extend({
  jbodEqual(received, expected) {
    const notEq = jbodEqual(received, expected);
    return {
      pass: notEq === undefined,
      message: () => notEq!,
    };
  },
  isJbodSymbol(received, expected: Symbol) {
    let msg = "";
    const res: SyncExpectationResult = {
      message: () => msg,
      pass: false,
      actual: received,
      expected,
    };
    if (typeof received === "symbol") {
      res.actual = received.description;
      res.expected = expected.description;
      res.pass = received.description === expected.description;
      msg = `Expect Symbol.description is equal`;
    } else {
      res.actual = baseType(received);
      res.expected = "symbol";
      msg = `Expect typeof symbol`;
    }
    return res;
  },
  isJbodArrayBuffer(received, expected: ArrayBuffer) {
    let msg = "";
    const res: SyncExpectationResult = {
      message: () => msg,
      pass: false,
    };
    if (received instanceof ArrayBuffer) {
      const rec = Buffer.from(received).toString("hex");
      const exp = Buffer.from(expected).toString("hex");
      res.pass = rec === exp;
      res.actual = rec;
      res.expected = exp;
    } else {
      msg = `${received} is not ArrayBuffer instance`;
      res.actual = type(received);
      res.expected = "ArrayBuffer";
    }
    return res;
  },
  isJbodError(received: Error, expected: Error) {
    expect(received).instanceof(JbodError);
    expect(received).toMatchObject({
      message: expected.message,
      name: expected.name,
    });
    if (Object.hasOwn(expected, "code")) {
      expect(received).haveOwnProperty("code", (expected as any).cdoe);
    } else expect(received).not.haveOwnProperty("code");
    const cause = jbodEqual(received.cause, expected.cause);
    if (cause) {
      return {
        message: () => cause,
        pass: false,
      };
    }

    return {
      message: () => "",
      pass: true,
    };
  },
  isJbodMap(received, expected: Object) {
    const redundantKeys = new Set(Object.keys(received));
    const items = Object.entries(expected);
    const notEqIndex: Record<string, any> = {};
    for (const [key, exp] of items) {
      const isNotEq = jbodEqual(received[key], exp);
      if (isNotEq) {
        notEqIndex[key] = isNotEq;
      }
      redundantKeys.delete(key);
    }
    for (const key of redundantKeys) {
      notEqIndex[key] = `Expect key '${key}' is not exist`;
    }
    return {
      pass: Object.keys(notEqIndex).length === 0,
      message: () => JSON.stringify(notEqIndex, null, 2),
    };
  },
  isJbodArray(received: any[], expected: any[]) {
    const notEqIndex: Record<string, any> = {};

    for (let i = 0; i < expected.length; i++) {
      const notEq = jbodEqual(received[i], expected[i]);
      if (notEq) notEqIndex[i] = notEq;
    }
    let redundantIndex = received.length - expected.length;
    if (redundantIndex > 0) {
      let index = redundantIndex === 1 ? expected.length : `${expected.length}-${received.length - 1}`;
      notEqIndex[index] = `Expect length ${received.length} to be ${expected.length}`;
    }

    return {
      message: () => JSON.stringify(notEqIndex, null, 2),
      pass: Object.keys(notEqIndex).length === 0,
    };
  },
});
interface SyncExpectationResult {
  pass: boolean;
  message: () => string;
  actual?: any;
  expected?: any;
}
function type(val: any) {
  let type = baseType(val);
  if (type !== "object") return type;
  return val.constructor?.name as string;
}
function baseType(val: string) {
  let type = typeof val;
  if (type !== "object") return type;
  else if (val === null) return "null";
  return type;
}

function jbodEqual(received: any, expected: any) {
  const expType = baseType(expected);
  if (expType !== baseType(received)) {
    return `Expect ${expType} type. Actual ${baseType(received)} type`;
  }
  try {
    if (expType === "object") {
      if (expected instanceof Error) {
        expect(received).isJbodError(expected);
      } else if (expected instanceof ArrayBuffer) {
        expect(received).isJbodArrayBuffer(expected);
      } else if (expected instanceof Array) {
        expect(received).isJbodArray(expected);
      } else {
        expect(received).isJbodMap(expected);
      }
    } else if (expType === "symbol") {
      expect(received).isJbodSymbol(expected);
    } else {
      expect(received).toBe(expected);
    }
  } catch (error) {
    return (error as Error).message;
  }
}
interface AssertionError extends Error {
  actual?: unknown;
  expected?: unknown;
}
