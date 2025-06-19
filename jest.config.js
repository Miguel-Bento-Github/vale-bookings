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
  testTimeout: 8000, // Reduced timeout for faster in-memory tests
  verbose: false,
  // Performance optimizations for in-memory database
  maxWorkers: '50%', // Enable parallel execution for better speed
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
  // Transform and module resolution optimizations for speed
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      isolatedModules: true, // Faster compilation
      useESM: false, // Disable ESM for better performance
      tsconfig: {
        sourceMap: false, // Disable source maps for faster compilation
        incremental: true, // Enable incremental compilation
        skipLibCheck: true, // Skip type checking for libraries
      }
    }]
  },
  // Reduce module resolution overhead
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  // Speed up test discovery
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Enable faster file watching and caching
  clearMocks: true,
  resetMocks: false,
  restoreMocks: false,
  // Optimize memory usage
  logHeapUsage: false,
  detectOpenHandles: false, // Disable for better performance
  forceExit: true, // Force exit for faster shutdown
}; 