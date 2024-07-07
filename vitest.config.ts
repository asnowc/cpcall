import { defineConfig } from "vitest/config";
import * as path from "node:path";

const root = __dirname;

export default defineConfig({
  esbuild: { target: "es2023" },
  test: {
    api: 8809,
    alias: [
      { find: /^cpcall$/, replacement: path.resolve(root, "src/cpc/mod.ts") },
      { find: /^cpcall\/node$/, replacement: path.resolve(root, "src/node/mod.ts") },
      { find: /^cpcall\/web$/, replacement: path.resolve(root, "src/web/mod.ts") },
    ],
    coverage: {
      exclude: ["**/__mocks__", "**/*errors.ts", "**/*.type.ts", "**/lib/**"],
      include: ["src"],
    },
  },
});
