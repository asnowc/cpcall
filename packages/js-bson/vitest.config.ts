import { defineProject } from "vitest/config";
import * as path from "node:path";
const root = __dirname;
export default defineProject({
    test: {
        alias: [{ find: /^@eavid\/js-bson$/, replacement: path.resolve(root, "src/js_bson.js") }],
    },
});
