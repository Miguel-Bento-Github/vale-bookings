import { Request, Response, NextFunction } from 'express';
import { Model } from 'mongoose';

import { WIDGET_ERROR_CODES } from '../constants/widget';
import { GuestBooking } from '../models/GuestBooking';
import Location from '../models/Location';
import { IGuestBooking } from '../types/widget';
import { logInfo, logError } from '../utils/logger';
import { validateEmail } from '../utils/validationHelpers';


// Express Request augmentation for apiKey property
declare module 'express-serve-static-core' {
  interface Request {
    apiKey?: {
      _id: string;
      keyPrefix: string;
      name: string;
      domainWhitelist: string[];
      isActive: boolean;
    };
  }
}

// Extend GuestBooking model interface to include static methods
interface IGuestBookingModel extends Model<IGuestBooking> {
  findByReference(referenceNumber: string): Promise<IGuestBooking | null>;
}

const GuestBookingModel = GuestBooking as IGuestBookingModel;

// Custom validation functions
interface LocationQueryValidated {
  page: number;
  limit: number;
  service?: string;
  lat?: number;
  lng?: number;
  radius?: number;
}

const validateLocationQuery = (query: Record<string, string | undefined>): { isValid: boolean; error?: string; data?: LocationQueryValidated } => {
  const page = parseInt(query.page) || 1;
  const limit = Math.min(parseInt(query.limit) || 10, 100);
  
  if (page < 1) return { isValid: false, error: 'Page must be greater than 0' };
  if (limit < 1 || limit > 100) return { isValid: false, error: 'Limit must be between 1 and 100' };
  
  const result: LocationQueryValidated = { page, limit };
  
  if (query.service) result.service = query.service;
  if (query.lat && query.lng) {
    const lat = parseFloat(query.lat);
    const lng = parseFloat(query.lng);
    if (isNaN(lat) || isNaN(lng)) return { isValid: false, error: 'Invalid coordinates' };
    result.lat = lat;
    result.lng = lng;
    result.radius = parseInt(query.radius) || 5000;
  }
  
  return { isValid: true, data: result };
};

interface AvailabilityQueryValidated {
  date: string;
  service: string;
}

const validateAvailabilityQuery = (query: Record<string, string | undefined>): { isValid: boolean; error?: string; data?: AvailabilityQueryValidated } => {
  if (!query.date || !query.service) {
    return { isValid: false, error: 'Date and service are required' };
  }
  
  if (!/^\d{4}-\d{2}-\d{2}$/.test(query.date)) {
    return { isValid: false, error: 'Invalid date format. Use YYYY-MM-DD' };
  }
  
  return { isValid: true, data: { date: query.date, service: query.service } };
};

type BookingRequestBody = Record<string, unknown>;

const validateBookingData = (body: BookingRequestBody): { isValid: boolean; error?: string; data?: BookingRequestBody } => {
  const required = ['locationId', 'serviceId', 'guestEmail', 'guestName', 'guestPhone', 'bookingDate', 'bookingTime', 'duration', 'gdprConsent'];
  
  for (const field of required) {
    if (!body[field]) {
      return { isValid: false, error: `${field} is required` };
    }
  }
  
  // Email validation
  const emailError = validateEmail(body.guestEmail);
  if (emailError) return { isValid: false, error: emailError };
  
  // Date format validation
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.bookingDate)) {
    return { isValid: false, error: 'Invalid date format. Use YYYY-MM-DD' };
  }
  
  // Time format validation
  if (!/^\d{2}:\d{2}$/.test(body.bookingTime)) {
    return { isValid: false, error: 'Invalid time format. Use HH:MM' };
  }
  
  // Duration validation
  const duration = parseInt(body.duration);
  if (isNaN(duration) || duration < 15 || duration > 480) {
    return { isValid: false, error: 'Duration must be between 15 and 480 minutes' };
  }
  
  // GDPR consent validation
  if (!body.gdprConsent?.version || !body.gdprConsent?.acceptedAt || !body.gdprConsent?.ipAddress) {
    return { isValid: false, error: 'GDPR consent is required with version, acceptedAt, and ipAddress' };
  }
  
  return { isValid: true, data: body };
};

const validateReferenceNumber = (reference: string): boolean => {
  return /^W[A-Z0-9]{8}$/.test(reference);
};

// Widget configuration
const getConfig = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.apiKey) {
      res.status(401).json({
        success: false,
        error: 'API key required',
        errorCode: WIDGET_ERROR_CODES.INVALID_API_KEY
      });
      return;
    }

    const config = {
      apiKey: req.apiKey?.keyPrefix,
      theme: {
        primaryColor: '#2563eb',
        secondaryColor: '#64748b',
        borderRadius: '6px'
      },
      features: {
        guestCheckout: true,
        requirePhone: false,
        enableSMS: true,
        enableReminders: true,
        showMap: true
      },
      localization: {
        defaultLanguage: 'en',
        supportedLanguages: ['en', 'es', 'fr'],
        timeFormat: '12h',
        dateFormat: 'MM/DD/YYYY'
      }
    };

    logInfo('Widget configuration retrieved', { apiKey: req.apiKey?.keyPrefix });

    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    logError('Error retrieving widget configuration', { error: error instanceof Error ? error.message : 'Unknown error' });
    next(error);
  }
};

// Get locations with filtering and pagination
const getLocations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validation = validateLocationQuery(req.query);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        error: validation.error,
        errorCode: 'VALIDATION_ERROR'
      });
      return;
    }

    const { page, limit, service, lat, lng, radius } = validation.data;
    const skip = (page - 1) * limit;

    // Build query
    const query: any = { isActive: true };

    if (service) {
      query.services = { $in: [service] };
    }

    if (lat && lng) {
      query.coordinates = {
        $geoWithin: {
          $centerSphere: [[lng, lat], radius / 6378100] // radius in radians
        }
      };
    }

    const [locations, total] = await Promise.all([
      Location.find(query)
        .limit(limit)
        .skip(skip)
        .lean(),
      Location.countDocuments(query)
    ]);

    const pagination = {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    };

    logInfo('Locations retrieved', { 
      count: locations.length, 
      page, 
      total,
      filters: { service, hasGeoFilter: !!(lat && lng) }
    });

    res.status(200).json({
      success: true,
      data: {
        locations,
        pagination
      }
    });
  } catch (error) {
    logError('Error retrieving locations', { error: error instanceof Error ? error.message : 'Unknown error' });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch locations',
      errorCode: 'INTERNAL_ERROR'
    });
  }
};

// Get availability for a specific location
const getAvailability = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { locationId } = req.params;
    const validation = validateAvailabilityQuery(req.query);
    
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        error: validation.error,
        errorCode: 'VALIDATION_ERROR'
      });
      return;
    }

    const { date, service } = validation.data;

    const location = await Location.findById(locationId);
    if (!location) {
      res.status(404).json({
        success: false,
        error: 'Location not found',
        errorCode: WIDGET_ERROR_CODES.BOOKING_NOT_FOUND
      });
      return;
    }

    // Calculate availability (mocked for now - this would be a complex business logic)
    const slots = await calculateAvailability(locationId || '', date, service);

    logInfo('Availability retrieved', { locationId, date, service, slotsCount: slots.length });

    res.status(200).json({
      success: true,
      data: {
        locationId,
        date,
        service,
        slots
      }
    });
  } catch (error) {
    logError('Error retrieving availability', { error: error instanceof Error ? error.message : 'Unknown error' });
    next(error);
  }
};

// Create a new booking
const createBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validation = validateBookingData(req.body);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        error: `Validation error: ${validation.error}`,
        errorCode: 'VALIDATION_ERROR'
      });
      return;
    }

    const bookingData = validation.data;

    // Verify location exists
    const location = await Location.findById(bookingData.locationId);
    if (!location || !location.isActive) {
      res.status(404).json({
        success: false,
        error: 'Location not found or inactive',
        errorCode: WIDGET_ERROR_CODES.BOOKING_NOT_FOUND
      });
      return;
    }

    // Check if time slot is available
    const existingBooking = await GuestBooking.findOne({
      locationId: bookingData.locationId,
      bookingDate: bookingData.bookingDate,
      bookingTime: bookingData.bookingTime,
      status: { $in: ['pending', 'confirmed'] }
    });

    if (existingBooking) {
      res.status(409).json({
        success: false,
        error: 'Time slot not available',
        errorCode: WIDGET_ERROR_CODES.SLOT_UNAVAILABLE
      });
      return;
    }

    // Create booking
    const guestBooking = new GuestBooking({
      ...bookingData,
      apiKeyId: req.apiKey?._id || '',
      auditTrail: [{
        action: 'BOOKING_CREATED',
        timestamp: new Date(),
        ipAddress: req.ip,
        userAgent: (req.headers['user-agent'] as string) || 'Unknown'
      }]
    });

    const savedBooking = await guestBooking.save();

    logInfo('Guest booking created', { 
      referenceNumber: savedBooking.referenceNumber,
      locationId: bookingData.locationId,
      bookingDate: bookingData.bookingDate
    });

    res.status(201).json({
      success: true,
      data: {
        referenceNumber: savedBooking.referenceNumber,
        status: savedBooking.status,
        bookingDate: savedBooking.bookingDate,
        bookingTime: savedBooking.bookingTime,
        locationId: savedBooking.locationId
      }
    });
  } catch (error) {
    logError('Error creating booking', { error: error instanceof Error ? error.message : 'Unknown error' });
    next(error);
  }
};

// Get booking by reference number
const getBooking = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { reference } = req.params;

    // Validate reference format
    if (!reference || !validateReferenceNumber(reference)) {
      res.status(400).json({
        success: false,
        error: 'Invalid reference number format',
        errorCode: WIDGET_ERROR_CODES.INVALID_REFERENCE
      });
      return;
    }

    const booking = await GuestBookingModel.findByReference(reference);
    if (!booking) {
      res.status(404).json({
        success: false,
        error: 'Booking not found',
        errorCode: WIDGET_ERROR_CODES.BOOKING_NOT_FOUND
      });
      return;
    }

    logInfo('Booking retrieved', { referenceNumber: reference });

    // Return sanitized booking data (no PII)
    res.status(200).json({
      success: true,
      data: {
        referenceNumber: booking.referenceNumber,
        status: booking.status,
        bookingDate: booking.bookingDate,
        bookingTime: booking.bookingTime,
        locationId: booking.locationId
      }
    });
  } catch (error) {
    logError('Error retrieving booking', { error: error instanceof Error ? error.message : 'Unknown error' });
    next(error);
  }
};

// Helper function to calculate availability (simplified for now)
interface Slot {
  time: string;
  available: boolean;
  price: number;
}

const calculateAvailability = async (locationId: string, date: string, service: string): Promise<Slot[]> => {
  // This is a simplified implementation - in reality this would involve:
  // - Location schedule
  // - Service duration
  // - Existing bookings
  // - Pricing rules
  // - Staff availability
  
  return [
    { time: '09:00', available: true, price: 100 },
    { time: '10:00', available: true, price: 100 },
    { time: '11:00', available: false, price: 100 },
    { time: '14:00', available: true, price: 120 }
  ];
};

// Export controller functions
export const widgetController = {
  getConfig,
  getLocations,
  getAvailability,
  createBooking,
  getBooking,
  calculateAvailability
}; 