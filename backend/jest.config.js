export default {
  transform: {},
  testEnvironment: "node",
  moduleFileExtensions: ["js", "mjs"],
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverage: true,
  coverageDirectory: "logs/coverage",
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
};
