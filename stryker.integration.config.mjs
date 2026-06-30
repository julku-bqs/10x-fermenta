/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: "vitest",
  checkers: ["typescript"],
  tsconfigFile: "tsconfig.json",
  vitest: {
    configFile: "vitest.integration.config.ts",
  },
  mutate: ["src/pages/api/**/*.ts", "src/lib/services/**/*.ts", "!src/lib/services/**/__tests__/**"],
  reporters: ["html", "clear-text", "progress"],
  coverageAnalysis: "perTest",
  concurrency: 2,
  thresholds: { high: 80, low: 60, break: null },
};

export default config;
