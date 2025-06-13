import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import routes from '../../src/routes';

const createTestApp = (): express.Application => {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(morgan('combined'));

  // Content type validation middleware
  app.use((req: express.Request, res: express.Response, next: express.NextFunction): void => {
    // Only check POST/PUT/PATCH requests that should have JSON bodies
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const contentType = req.get('Content-Type');

      // If content-type is explicitly set to something other than JSON, reject it
      if (contentType && contentType.includes('text/plain')) {
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
  app.use(express.json({
    limit: '10kb', // Limit payload size
    verify: (req: express.Request, res: express.Response, buf: Buffer, encoding: string) => {
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
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api', routes);

  // Error handling middleware
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  });

  return app;
};

export default createTestApp; 