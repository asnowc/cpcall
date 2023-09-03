import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        coverage: {
            exclude: ["**/__mocks__", "**/*errors.ts", "**/*.type.ts", "**/lib/**"],
        },
    },
});
