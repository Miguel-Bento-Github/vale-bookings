import { Router, Request, Response, NextFunction } from 'express';

import { widgetController } from '../controllers/WidgetController';
import { validateRequest, extractApiKey, rateLimitRequest } from '../middleware/widgetAuth';
import { logInfo } from '../utils/logger';

const router = Router();

// Widget API middleware stack
const widgetAuth = [
  extractApiKey,
  rateLimitRequest,
  validateRequest
];

// Wrapper for async routes
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Widget configuration endpoint
router.get('/config', 
  ...widgetAuth,
  (req, res, next) => {
    logInfo('Widget config requested', { 
      apiKey: req.apiKey?.keyPrefix,
      origin: req.headers.origin
    });
    next();
  },
  widgetController.getConfig
);

// Locations endpoints
router.get('/locations', 
  ...widgetAuth,
  (req, res, next) => {
    logInfo('Widget locations requested', { 
      apiKey: req.apiKey?.keyPrefix,
      query: req.query
    });
    next();
  },
  asyncHandler(widgetController.getLocations)
);

router.get('/locations/:locationId/availability', 
  ...widgetAuth,
  (req, res, next) => {
    logInfo('Widget availability requested', { 
      apiKey: req.apiKey?.keyPrefix,
      locationId: req.params.locationId,
      query: req.query
    });
    next();
  },
  asyncHandler(widgetController.getAvailability)
);

// Booking endpoints
router.post('/bookings', 
  ...widgetAuth,
  (req, res, next) => {
    const body = req.body as Record<string, unknown>;
    logInfo('Widget booking creation requested', { 
      apiKey: req.apiKey?.keyPrefix,
      locationId: body.locationId
    });
    next();
  },
  asyncHandler(widgetController.createBooking)
);

router.get('/bookings/:reference', 
  ...widgetAuth,
  (req, res, next) => {
    logInfo('Widget booking retrieval requested', { 
      apiKey: req.apiKey?.keyPrefix,
      reference: req.params.reference
    });
    next();
  },
  asyncHandler(widgetController.getBooking)
);

// Catch-all 404 for debugging
router.use((req, res) => {
  // Log unmatched requests and params
  // eslint-disable-next-line no-console
  console.error('DEBUG 404:', req.method, req.originalUrl, req.params);
  res.status(404).json({
    success: false,
    error: 'Not found',
    errorCode: 'NOT_FOUND',
    params: req.params
  });
});

export default router; 