/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: "vitest",
  checkers: ["typescript"],
  tsconfigFile: "tsconfig.json",
  mutate: ["src/lib/**/*.ts", "!src/lib/**/__tests__/**"],
  reporters: ["html", "clear-text", "progress"],
  coverageAnalysis: "perTest",
  concurrency: 4,
  thresholds: { high: 80, low: 60, break: null },
};

export default config;
