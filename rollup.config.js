// @ts-check

import { defineEvConfig } from "@eavid/lib-dev/rollup";
import * as path from "node:path";
import { isBuiltin } from "node:module";
// @ts-ignore
import packageJson from "./package.json" with { type: "json" };

const { deps } = getDeps();
const src = path.resolve("src");
const DEV=Boolean(process.env.DEV)
if(DEV){
  console.log("Build in dev mode");
}
export default defineEvConfig({
  input: {
    cpc: "src/cpc/mod.ts",
    node: "src/node/mod.ts",
    web: "src/web/mod.ts",
  },
  output: {
    dir: "dist",
    chunkFileNames: "internal/[name].js",
    minifyInternalExports: false,
    entryFileNames: "[name].js",
    sourcemap:DEV,
    sourcemapExcludeSources:true,
    manualChunks(id, meta) {
      if (id.startsWith(src)) return;
      else return "deps";
    },
  },
  external(source, importer, isResolved) {
    if (isResolved) return;
    if (path.isAbsolute(source)) return;
    else if (source.startsWith(".")) return;

    if (isBuiltin(source)) return true;
    if (isDeps(deps, source)) {
      return true;
    }
  },
  extra: {
    typescript: {
      compilerOptions: {
        module: "NodeNext",
        rootDir: "src",
        outDir: "./dist",
        noEmit: false,
        declaration: true,
        declarationDir: "dist/types",
        lib: ["ESNext", "dom"],
      },
    },
    resolve: {},
  },
});
/**
 * @param {Set<string>} deps
 * @param {string} id
 */
function isDeps(deps, id) {
  if (deps.has(id)) return true;
  for (const item of deps) {
    if (id.startsWith(item + "/")) return true;
  }
}

function getDeps() {
  const { dependencies, devDependencies, peerDependencies } = packageJson;
  const devDeps = new Set();

  if (devDependencies) {
    for (const item of Object.keys(devDependencies)) {
      devDeps.add(item);
    }
  }
  if (peerDependencies) {
    for (const item of Object.keys(peerDependencies)) {
      devDeps.add(item);
    }
  }
  return {
    deps: new Set(Object.keys(dependencies)),
    devDeps,
  };
}
