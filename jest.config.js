module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/types/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  testTimeout: 10000,
  verbose: false, // Reduce verbose output for CI/non-interactive
  // Optimize parallel execution
  maxWorkers: '75%', // Use 75% of available CPU cores
  // Cache to speed up subsequent runs
  cache: true,
  // Run tests in parallel within files
  testRunner: 'jest-circus/runner',
  // Non-interactive configuration
  watchman: false, // Disable watchman for non-interactive runs
  silent: false, // Keep test output but reduce noise
  // Coverage configuration for non-interactive
  coverageReporters: ['text', 'json', 'html'],
  // Disable watch mode by default
  watchAll: false
}; 