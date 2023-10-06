import * as rollup from "@eavid/lib-dev/rollup";
import * as path from "node:path";

/** @type {typeof import("@eavid/lib-dev/out/rollup/mod")} */
const { defineEvConfig } = rollup
const dir = process.cwd()
console.log("cwd:" + dir);
const libDir = path.resolve(dir, "src/cpc/lib")

export default defineEvConfig({
    input: {
        "cpc": "src/cpc/cpc.ts",
        "node": "src/node/node.ts",
        "web": "src/web/web.ts"
    },
    output: {
        dir: "dist",
        chunkFileNames: "internal/[name].js",
        minifyInternalExports: false,
        entryFileNames: "[name]/[name].js",
        manualChunks(id, meta) {
            if (id.startsWith(libDir)) return "lib"
        }
    },
    extra: {
        typescript: {
            module: "NodeNext",
            rootDir: "src",
            outDir: "./dist",
            noEmit: false,
            declaration: true,
            declarationMap: true
        }
    }
});