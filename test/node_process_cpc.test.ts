import { describe, it, expect } from "vitest";
import { PsCpcMocks } from "./__mocks__/node_process_cpc.mock.js";
import { cpc } from "./__mocks__/cpc.cases.js";

const mocks = new PsCpcMocks();

describe("Cpc", cpc(mocks));
