export default {
  transform: {},
  testEnvironment: "node",
  moduleFileExtensions: ["js", "mjs"],
  // Cobre todos os subdiretórios de tests/
  testMatch: [
    "**/tests/**/*.test.js",
    "**/tests/unit/**/*.test.js",
    "**/tests/middleware/**/*.test.js",
    "**/tests/integration/**/*.test.js",
    "**/tests/security/**/*.test.js",
  ],
  collectCoverage: true,
  coverageDirectory: "logs/coverage",
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/scripts/**",
    "!src/config/prisma.js",
    "!src/config/supabase.js",
  ],
  coverageThresholds: {
    global: {
      statements: 30,
      branches: 20,
      functions: 30,
      lines: 30,
    },
  },
  coverageReporters: ["text", "lcov", "html"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  // Timeout maior para testes de integração
  testTimeout: 15000,
};
