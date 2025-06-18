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
  testTimeout: 15000, // Increased slightly for slower CI environments
  verbose: false,
  // Performance optimizations
  maxWorkers: 1, // Force serial execution for database tests
  cache: true,
  cacheDirectory: '<rootDir>/node_modules/.cache/jest',
  // Faster test runner
  testRunner: 'jest-circus/runner',
  // Reduce file system watchers
  watchman: false,
  silent: false,
  // Optimized coverage reporting
  coverageReporters: ['text-summary', 'json'],
  watchAll: false,
  // Removed global setup for now - using per-file setup for reliability
  // Transform and module resolution optimizations
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      isolatedModules: true, // Faster compilation
      tsconfig: {
        sourceMap: false // Disable source maps for faster compilation
      }
    }]
  },
  // Reduce module resolution overhead
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  // Speed up test discovery
  testPathIgnorePatterns: ['/node_modules/', '/dist/']
}; 