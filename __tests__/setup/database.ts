import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod: MongoMemoryServer;

export const connectDatabase = async (): Promise<void> => {
    // Start in-memory MongoDB instance
    mongod = await MongoMemoryServer.create({
        binary: {
            version: '6.0.4',
        },
        instance: {
            dbName: 'test_valet_db',
        },
    });

    const uri = mongod.getUri();

    // Connect with optimized settings for testing
    await mongoose.connect(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false,
    });
};

export const clearDatabase = async (): Promise<void> => {
    if (mongoose.connection.readyState !== 0) {
        const collections = mongoose.connection.collections;

        // Clear all collections in parallel for speed
        await Promise.all(
            Object.values(collections).map(collection => collection.deleteMany({}))
        );
    }
};

export const closeDatabase = async (): Promise<void> => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
    }

    if (mongod) {
        await mongod.stop();
    }
};

// Global setup for Jest
export const setupTestDatabase = async (): Promise<void> => {
    await connectDatabase();
};

// Global teardown for Jest  
export const teardownTestDatabase = async (): Promise<void> => {
    await closeDatabase();
}; 