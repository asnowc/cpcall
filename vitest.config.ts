import { defineConfig } from "vitest/config";
import * as path from "node:path";

const root = __dirname;

export default defineConfig({
  esbuild: { target: "es2020" },
  test: {
    api: 8809,
    alias: [{ find: /^cpcall$/, replacement: path.resolve(root, "src/mod.ts") }],
    coverage: {
      include: ["src"],
    },
  },
});
