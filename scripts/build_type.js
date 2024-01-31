// @ts-check
import { rollup, plugins, defineConfig } from "@eavid/lib-dev/rollup";
import * as path from "node:path";
import { dts } from "rollup-plugin-dts";
import fs from "node:fs/promises";
import config from "../rollup.config.js";

const dist = path.resolve("dist");
console.log("build type...");
await buildType();
console.log("clear...");
await clearDts();

async function buildType() {
  const typeConfig = defineConfig({
    input: {
      cpc: "dist/cpc/mod.d.ts",
      node: "dist/node/mod.d.ts",
      web: "dist/web/mod.d.ts",
    },
    plugins: [
      dts({
        respectExternal: true,
        compilerOptions: {
          rootDir: "./dist",
          noEmit: false,
        },
      }),
      plugins.nodeResolve(),
    ],
    external: config.external,
  });
  const r = await rollup(typeConfig);
  await r.write({
    dir: "dist",
    chunkFileNames: "internal/[name].ts",
    minifyInternalExports: false,
    manualChunks(id, meta) {
      if (id.startsWith(dist)) return;
      else return "deps.d";
    },
  });
}
async function clearDts() {
  await fs.rm("dist/cpc", { recursive: true });
  await fs.rm("dist/node", { recursive: true });
  await fs.rm("dist/web", { recursive: true });
}
