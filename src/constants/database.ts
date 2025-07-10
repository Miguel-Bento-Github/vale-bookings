export const DATABASE_CONFIG = {
  // Main database
  MONGODB_URI: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/vale_db',
  
  // Test database
  MONGODB_TEST_URI: process.env.MONGODB_TEST_URI ?? 'mongodb://localhost:27017/vale_db',
  
  // Queue service database
  MONGODB_URL: process.env.MONGODB_URL ?? 'mongodb://localhost:27017/vale_db'
} as const; 