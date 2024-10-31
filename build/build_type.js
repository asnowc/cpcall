// @ts-check
import { rollup, plugins, defineConfig } from "@eavid/lib-dev/rollup";
import { dts } from "rollup-plugin-dts";
import fs from "node:fs/promises";
import config from "./rollup.config.js";

console.log("build type...");
await buildType();
console.log("clear...");
await clearDts();

async function buildType() {
  const typeConfig = defineConfig({
    input: { mod: "dist/types/mod.d.ts" },
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
    minifyInternalExports: false,
  });
}
async function clearDts() {
  await fs.rm("dist/types", { recursive: true });
}
