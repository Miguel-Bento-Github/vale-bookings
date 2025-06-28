import { createServer } from 'http';

import cors from 'cors';
import express, { Request, Response, NextFunction, json } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';

import adminRoutes from './routes/admin';
import authRoutes from './routes/auth';
import bookingRoutes from './routes/bookings';
import locationRoutes from './routes/locations';
import scheduleRoutes from './routes/schedules';
import userRoutes from './routes/users';
import widgetRoutes from './routes/widget';
import { initializeWebSocket } from './services/WebSocketService';
import { AppError } from './types';
import { createPrettyLogger, responseTimeMiddleware, logError } from './utils/logger';
import { sendError } from './utils/responseHelpers';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Response time tracking and logging
app.use(responseTimeMiddleware);

// Logging - disable during tests and when explicitly disabled
if (process.env.NODE_ENV !== 'test' &&
  process.env.DISABLE_LOGGING !== 'true' &&
  !process.argv.includes('--coverage') &&
  !process.argv.includes('jest')) {
  app.use(createPrettyLogger());
}

// Content type validation middleware
app.use((req: Request, res: Response, next: NextFunction): void => {
  // Only check POST/PUT/PATCH requests that should have JSON bodies
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');

    // If content-type is explicitly set to something other than JSON, reject it
    if (contentType?.includes('text/plain') === true) {
      sendError(res, 'Invalid JSON payload', 400);
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
    } catch {
      sendError(res, 'Invalid JSON payload', 400);
      throw new Error('Invalid JSON');
    }
  }
}));

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'valet-backend'
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/widget/v1', widgetRoutes);

// Test routes for error handling
app.get('/api/test-error', () => {
  throw new AppError('Test error', 400);
});

app.get('/api/test-unknown-error', () => {
  throw new Error('Unknown error');
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode);
  } else {
    logError('Unhandled error:', err);
    sendError(res, 'Internal server error', 500);
  }
});

// Create HTTP server and initialize WebSocket
const httpServer = createServer(app);
initializeWebSocket(httpServer);

export default app;
export { httpServer }; 