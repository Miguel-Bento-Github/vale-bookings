import { config } from 'dotenv';
import mongoose from 'mongoose';

import app, { httpServer } from './app';
import { logInfo, logSuccess, logError } from './utils/logger';

config();
const PORT = process.env.PORT ?? '3000';

// Database connection and server start
const startServer = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/vale_db';
    await mongoose.connect(mongoUri);
    logSuccess('Connected to MongoDB');
    
    // Ensure all indexes are created
    const { default: Location } = await import('./models/Location');
    await Location.createIndexes();
    logInfo('Database indexes created');

    httpServer.listen(PORT, () => {
      logSuccess(`Server running on port ${PORT} with WebSocket support`);
    });
  } catch (error) {
    logError('Failed to start server:', error);
    throw error; // Throw instead of process.exit
  }
};

if (process.env.NODE_ENV !== 'test') {
  void startServer(); // Explicitly mark as ignored floating promise
}

export default app; 