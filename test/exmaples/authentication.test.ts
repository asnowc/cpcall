import { describe } from "vitest";
import { cpcTest as test } from "../env/cpc.env.ts";

describe.todo(function () {
  test("权限", function ({ cpcSuite }) {
    const { cpc1 } = cpcSuite;

    class Service {
      m1() {}
    }

    cpc1.exposeObject(new Service());
  });
});
