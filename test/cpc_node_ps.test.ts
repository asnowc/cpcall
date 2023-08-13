import { describe, it, expect } from "vitest";
import { PsCpcMocks } from "./__mocks__/cpc_node_ps.mock.js";
import { cpc } from "./__mocks__/cpc.cases.js";

const mocks = new PsCpcMocks();

describe("Cpc", cpc(mocks));
