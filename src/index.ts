import cors from 'cors';
import { config } from 'dotenv';
import express, { Request, Response, NextFunction, json, urlencoded } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';
import morgan from 'morgan';

import routes from './routes';
import { AppError } from './types';


config();

const app = express();
const PORT = process.env.PORT ?? '3000';

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Logging
app.use(morgan('combined'));

// Content type validation middleware
app.use((req: Request, res: Response, next: NextFunction): void => {
  // Only check POST/PUT/PATCH requests that should have JSON bodies
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');

    // If content-type is explicitly set to something other than JSON, reject it
    if (contentType !== undefined && contentType.includes('text/plain')) {
      res.status(400).json({
        success: false,
        message: 'Invalid JSON payload'
      });
      return;
    }
  }
  next();
});

// JSON parsing with error handling
app.use(json({
  limit: '10kb', // Limit payload size
  verify: (req: Request, res: Response, buf: Buffer, _encoding: string) => {
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      res.status(400).json({
        success: false,
        message: 'Invalid JSON payload'
      });
      throw new Error('Invalid JSON');
    }
  }
}));
app.use(urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', routes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  } else {
    console.error('Error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Database connection and server start
const startServer = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/vale_db';
    await mongoose.connect(mongoUri);
    console.info('Connected to MongoDB');
    
    // Ensure all indexes are created
    const { default: Location } = await import('./models/Location');
    await Location.createIndexes();
    console.info('Database indexes created');

    app.listen(PORT, () => {
      console.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    throw error; // Throw instead of process.exit
  }
};

if (process.env.NODE_ENV !== 'test') {
  void startServer(); // Explicitly mark as ignored floating promise
}

export default app; 