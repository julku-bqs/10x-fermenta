import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    exclude: ["**/node_modules/**", "packages/**", ".github/**", "src/__tests__/integration/**", "tests/e2e/**"],
  },
});
