import { defineConfig } from "vitest/config";
import * as path from "node:path";

import deno from "@deno/vite-plugin";
const root = __dirname;

export default defineConfig({
  plugins: [deno()],
  test: {
    api: 8809,
    alias: [{ find: /^cpcall$/, replacement: path.resolve(root, "src/mod.ts") }],
    coverage: {
      include: ["src"],
    },
  },
});
