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
  coverageThreshold: {
    global: {
      statements: 28,
      branches: 20,
      functions: 25,
      lines: 28,
    },
  },
  coverageReporters: ["text", "lcov", "html", "json-summary"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  // Timeout maior para testes de integração
  testTimeout: 15000,
};
