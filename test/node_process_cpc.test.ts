import { describe, it, expect } from "vitest";
import {} from "./__mocks__/node_process_cpc.mock.js";
import { PsCpcMocks } from "./__mocks__/node_process_cpc.mock.js";
import { cpc } from "./__mocks__/cpc.cases.js";
describe("Cpc", cpc(new PsCpcMocks()));
