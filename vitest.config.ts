import { defineConfig } from "vitest/config";
import * as path from "node:path";

const root = __dirname;
const packagesRoot = path.resolve(root, "../");

export default defineConfig({
  test: {
    alias: [
      { find: /^#lib/, replacement: path.resolve(root, "src/cpc/lib") },
      { find: /^cpcall$/, replacement: path.resolve(root, "src/cpc/cpc.js") },
      { find: /^cpcall\/node$/, replacement: path.resolve(root, "src/node/node.js") },
      { find: /^@eavid\/js-bson$/, replacement: path.resolve(packagesRoot, "js-bson/src/js_bson.js") },
    ],
    coverage: {
      exclude: ["**/__mocks__", "**/*errors.ts", "**/*.type.ts", "**/lib/**"],
    },
  },
});
