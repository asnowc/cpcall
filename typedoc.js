//@ts-check

/** @type { Partial<import("typedoc").TypeDocOptions>} */
export default {
  entryPoints: ["./src/cpc/mod.ts", "./src/web/mod.ts", "./src/node/mod.ts"],
  out: "docs/typedoc",
  tsconfig: "./tsconfig.build.json",
  excludePrivate: true,
  excludeProtected: true,
  includeVersion: true,
  disableSources: true, //不显示定义位置
};
