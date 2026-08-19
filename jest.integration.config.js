module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__/integration"],
  testMatch: ["**/__tests__/integration/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
  setupFilesAfterEnv: ["<rootDir>/__tests__/integration/setup.ts"],
  testTimeout: 30000,
  maxWorkers: 1,
  clearMocks: true,
  silent: true,
};
