import { defineConfig } from "vitest/config";

// Package-local test runner, deliberately isolated from the app's vitest program
// (this package is not part of the root workspace). Mirrors the repo's vitest ^4
// conventions.
export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
