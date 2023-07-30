import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        alias: {
            "#rt": __dirname + "/src",
        },
        coverage: {
            exclude: ["**/__mocks__","**/*errors.ts","**/*.type.ts"],
        },
    },
});
