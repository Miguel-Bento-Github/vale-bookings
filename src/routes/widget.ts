import { Router } from 'express';

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
  widgetController.getLocations
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
  widgetController.getAvailability
);

// Booking endpoints
router.post('/bookings', 
  ...widgetAuth,
  (req, res, next) => {
    logInfo('Widget booking creation requested', { 
      apiKey: req.apiKey?.keyPrefix,
      locationId: req.body.locationId
    });
    next();
  },
  widgetController.createBooking
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
  widgetController.getBooking
);

export default router; 