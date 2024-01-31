import { defineConfig } from "vitest/config";
import * as path from "node:path";

const root = __dirname;

export default defineConfig({
  test: {
    api: 8809,
    alias: [
      { find: /^cpcall$/, replacement: path.resolve(root, "src/cpc/mod.js") },
      { find: /^cpcall\/node$/, replacement: path.resolve(root, "src/node/mod.js") },
    ],
    coverage: {
      exclude: ["**/__mocks__", "**/*errors.ts", "**/*.type.ts", "**/lib/**"],
    },
  },
});
