import { createServer } from 'http';

import cors from 'cors';
import express, { Request, Response, NextFunction, json } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet, { frameguard } from 'helmet';

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

// Enhanced security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false // keep defaults but allow CORS reflection
}));
// Explicitly deny framing
app.use(frameguard({ action: 'deny' }));

// Reflect allowed origin dynamically for whitelisted domains – credentials enabled
app.use(cors({
  origin: (_origin, callback) => {
    // Allow all origins – downstream middleware (WidgetAuth) will 403 if not whitelisted
    callback(null, true);
  },
  credentials: true
}));

// Rate limiting – disabled during test runs to avoid interfering with performance/security suites
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
  });
  app.use(limiter);
}

// Explicit X-XSS-Protection header (helmet ≥6 no longer sets it)
app.use((_req, res, next): void => {
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

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
      res.status(400).json({
        success: false,
        error: 'Invalid content type',
        errorCode: 'BAD_REQUEST'
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
    } catch {
      res.status(400).json({
        success: false,
        error: 'Invalid JSON payload',
        errorCode: 'BAD_REQUEST'
      });
      throw new Error('Invalid JSON');
    }
  }
}));

// Handle JSON parsing errors (including payload too large)
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  if (error.message.includes('request entity too large') || error.message.includes('PayloadTooLargeError')) {
    res.status(400).json({
      success: false,
      error: 'Request payload too large',
      errorCode: 'VALIDATION_ERROR'
    });
    return;
  }
  if (error.message.includes('Invalid JSON')) {
    // Already handled in verify function
    return;
  }
  next(error);
});

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