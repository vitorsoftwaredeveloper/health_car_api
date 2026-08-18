module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.test.json" }],
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/types/**",
    "!src/schemas/**",
  ],
  coverageThreshold: {

    "src/domain/**/*.ts": { branches: 100, functions: 100, lines: 100, statements: 100 },
  },
  coverageReporters: ["text", "lcov", "html"],
  coverageDirectory: "coverage",
  clearMocks: true,
  silent: true,
};
