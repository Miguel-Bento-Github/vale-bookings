export const DATABASE_CONFIG = {
  // Main database
  MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/vale_db',
  
  // Test database
  MONGODB_TEST_URI: process.env.MONGODB_TEST_URI ?? 'mongodb://localhost:27017/test',
  
  // Queue service database
  MONGODB_URL: process.env.MONGODB_URL ?? 'mongodb://localhost:27017/vale_db',
  
  // Legacy test database (for backward compatibility)
  MONGODB_TEST_VALE_DB: process.env.MONGODB_TEST_URI ?? 'mongodb://localhost:27017/test_vale_db'
} as const; 