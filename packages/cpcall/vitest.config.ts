import { defineProject } from "vitest/config";
import * as path from "node:path";

const root = __dirname;
const packagesRoot = path.resolve(root, "../");
export default defineProject({
    test: {
        alias: [
            { find: /^#lib/, replacement: path.resolve(root, "src/core/lib") },
            { find: /^cpcall$/, replacement: path.resolve(root, "src/core/cpc.js") },
            { find: /^cpcall\/node$/, replacement: path.resolve(root, "src/node/index.js") },
            { find: /^@eavid\/js-bson$/, replacement: path.resolve(packagesRoot, "js-bson/src/js_bson.js") },
        ],
    },
});
