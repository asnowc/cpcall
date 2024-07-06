import { test } from "vitest";
import { MockCpcFrameSource } from "../__mocks__/CpcMockControl.ts";

interface CpcTestContext {}
const cpcTest = test.extend<CpcTestContext>({});
