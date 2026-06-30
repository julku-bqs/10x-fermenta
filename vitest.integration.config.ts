import path from "path";
import { defineConfig } from "vitest/config";

/**
 * Dedicated config for integration tests that hit a running Astro dev server + local Supabase.
 * Run with: npx vitest run --config vitest.integration.config.ts
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    include: ["src/__tests__/integration/**/*.test.ts"],
    globalSetup: ["src/__tests__/integration/globalSetup.ts"],
    testTimeout: 15000,
  },
});
