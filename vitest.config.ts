import { defineConfig } from "vitest/config";
import * as path from "node:path";

const root = __dirname;

export default defineConfig({
  test: {
    api: 8809,
    alias: [
      { find: /^#lib/, replacement: path.resolve(root, "src/cpc/lib") },
      { find: /^cpcall$/, replacement: path.resolve(root, "src/cpc/cpc.js") },
      { find: /^cpcall\/node$/, replacement: path.resolve(root, "src/node/node.js") },
    ],
    coverage: {
      exclude: ["**/__mocks__", "**/*errors.ts", "**/*.type.ts", "**/lib/**"],
    },
  },
});
