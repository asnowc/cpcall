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
await clearDts(process.argv[2] === "true");

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
/** @param {boolean} genRooType */
async function clearDts(genRooType) {
  await fs.rm("dist/types", { recursive: true });
  if (genRooType) {
    for (const item of ["node", "web"]) {
      await createType(item + ".d.ts", "./dist/" + item + ".js");
    }
  }
}
/**
 * @param {string} path 描述
 * @param {string} dtsPath 描述
 *
 */
function createType(path, dtsPath) {
  const data = `export * from "${dtsPath}"`;
  return fs.writeFile(path, data, { flag: "w+" });
}
