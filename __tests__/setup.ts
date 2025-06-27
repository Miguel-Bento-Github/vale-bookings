import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  // Create optimized MongoDB Memory Server with better performance settings
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '6.0.4', // Use stable version
      downloadDir: './node_modules/.cache/mongodb-memory-server' // Cache binaries
    },
    instance: {
      dbName: 'test_valet_db',
      storageEngine: 'ephemeralForTest' // Fastest storage engine for tests
    }
  });

  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri, {
    // Highly optimized connection settings for speed
    maxPoolSize: 10, // Increased pool size for parallel operations
    minPoolSize: 2, // Keep some connections alive
    serverSelectionTimeoutMS: 1000, // Faster timeout
    socketTimeoutMS: 10000, // Reduced socket timeout
    connectTimeoutMS: 2000, // Faster connection timeout
    maxIdleTimeMS: 30000, // Connection idle time
    bufferCommands: false, // Disable command buffering
    waitQueueTimeoutMS: 1000 // Fast queue timeout
  });

  // Warm up the connection
  await mongoose.connection.db?.admin().ping();
}, 15000);

afterAll(async () => {
  // Fast cleanup and shutdown
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close(false); // Force close
  }

  if (mongoServer) {
    await mongoServer.stop({ doCleanup: true, force: true });
  }
}, 10000);

afterEach(async () => {
  // Ultra-fast parallel cleanup of all collections
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;

    // Clear all collections in parallel for maximum speed
    await Promise.all(
      Object.values(collections).map(async (collection) => {
        try {
          await collection.deleteMany({});
        } catch (error) {
          // Collection might not exist, ignore errors
        }
      })
    );
  }
});

// Mock console methods to avoid test output pollution and improve performance
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Set NODE_ENV to test for better test isolation
process.env.NODE_ENV = 'test';

// Disable HTTP request logging in tests
process.env.DISABLE_LOGGING = 'true';

// Disable MongoDB logging for better performance
process.env.MONGODB_DISABLE_LOGGING = 'true';

// Mock Morgan to prevent HTTP logs in tests and improve performance
jest.mock('morgan', () => {
  return () => (req: any, res: any, next: any) => next();
});

// Mock bcrypt for faster password hashing in tests (but keep JWT working)
jest.mock('bcryptjs', () => ({
  hash: jest.fn(async (password: string) => `hashed_${password}`),
  compare: jest.fn(async (password: string, hash: string) => {
    return hash === `hashed_${password}`;
  }),
  genSalt: jest.fn(async () => 'mock-salt')
})); 