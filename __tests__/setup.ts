import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  // Create optimized MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create({
    binary: {
      version: '6.0.4' // Use stable version
    }
  });

  const mongoUri = mongoServer.getUri();

  await mongoose.connect(mongoUri, {
    // Optimized connection settings
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 3000,
    socketTimeoutMS: 30000
  });
});

afterAll(async () => {
  // Disconnect from MongoDB and stop the server
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  // Fast cleanup - only clear collections that are commonly used
  const collectionsToClean = ['users', 'locations', 'bookings', 'schedules'];

  await Promise.all(
    collectionsToClean.map(async (collectionName) => {
      try {
        const collection = mongoose.connection.db?.collection(collectionName);
        if (collection) {
          await collection.deleteMany({});
        }
      } catch {
      // Collection might not exist or be ready, skip silently
      }
    })
  );
});

// Mock console methods to avoid test output pollution
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

// Mock Morgan to prevent HTTP logs in tests
jest.mock('morgan', () => {
  return () => (req: any, res: any, next: any) => next();
}); 