import { defineConfig, UserConfig } from "vitest/config";
import * as path from "node:path";

const root = path.resolve(__dirname, "packages");
export default defineConfig({
    test: {
        alias: [
            ...createMap(root, [{ find: /^#lib\//, replacement: "src/core/lib/", testPkgName: /^cpcall$/ }]),
            { find: /^cpcall$/, replacement: path.resolve(root, "cpcall/src/core/cpc.js") },
            { find: /^cpcall\/node$/, replacement: path.resolve(root, "cpcall/src/node/index.js") },
            { find: /^@eavid\/js-bson/, replacement: path.resolve(root, "js-bson/src/js_bson.js") },
        ],
        coverage: {
            exclude: ["**/__mocks__", "**/*errors.ts", "**/*.type.ts"],
        },
    },
});
function createMap(root: string, options: PackagesAlias[]) {
    return options.map((item): Alias => {
        return {
            find: item.find,
            replacement: item.replacement,
            customResolver(source: string, importer?: string) {
                if (!importer) return source;
                importer = path.resolve(importer);
                if (importer.startsWith(root)) {
                    let pkgName = getPkgDirName(importer);
                    if (!item.testPkgName || item.testPkgName.test(pkgName)) return path.resolve(root, pkgName, source);
                }
                return source;
            },
        };
    });
}
function getPkgDirName(absPath: string): string {
    let subStr = absPath.slice(root.length + 1);
    return subStr.slice(0, subStr.indexOf(path.sep));
}
type Alias = NonNullable<NonNullable<UserConfig["test"]>["alias"]> extends readonly (infer P)[] | object ? P : never;

interface PackagesAlias {
    find: RegExp;
    replacement: string;
    testPkgName?: RegExp;
}
