import { Response, Request } from 'express';
import mongoose from 'mongoose';

import { ERROR_MESSAGES, BOOKING_STATUSES, USER_ROLES } from '../../../src/constants';
import { sendError } from '../../../src/utils/responseHelpers';
import { 
  validateCoordinates, 
  validateEmail as validateEmailCore, 
  validatePassword as validatePasswordCore 
} from '../../../src/utils/validation';
import {
  validateRequiredId,
  validatePaginationParams,
  validateTimeRange,
  validateCoordinatesFromRequest,
  validateLocationData,
  parseCoordinatesFromQuery,
  validateCoordinatesFromQuery,
  validateRequiredString,
  validateEmail,
  validatePassword,
  validateUserRole,
  validateAuthentication,
  validateAdminRole,
  validateUserAuthentication,
  validateBookingStatus,
  validateDateParam
} from '../../../src/utils/validationHelpers';

// Mock the dependencies
jest.mock('../../../src/utils/responseHelpers', () => ({
  sendError: jest.fn()
}));

jest.mock('../../../src/utils/validation', () => ({
  validateCoordinates: jest.fn(),
  validateEmail: jest.fn(),
  validatePassword: jest.fn()
}));

const mockSendError = sendError as jest.MockedFunction<typeof sendError>;
const mockValidateCoordinates = validateCoordinates as jest.MockedFunction<typeof validateCoordinates>;
const mockValidateEmailCore = validateEmailCore as jest.MockedFunction<typeof validateEmailCore>;
const mockValidatePasswordCore = validatePasswordCore as jest.MockedFunction<typeof validatePasswordCore>;

// Mock Response object
const mockResponse = {
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis()
} as unknown as Response;

describe('validationHelpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSendError.mockReturnValue(mockResponse);
    
    // Default mock implementations
    mockValidateCoordinates.mockReturnValue(true);
    mockValidateEmailCore.mockReturnValue(true);
    mockValidatePasswordCore.mockReturnValue(true);
  });

  describe('validateRequiredId', () => {
    it('should return true for valid ObjectId', () => {
      const validId = new mongoose.Types.ObjectId().toString();

      const result = validateRequiredId(validId, mockResponse);

      expect(result).toBe(true);
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should return false and send error for invalid ObjectId', () => {
      const invalidId = 'invalid-id';

      const result = validateRequiredId(invalidId, mockResponse);

      expect(result).toBe(false);
      expect(mockSendError).toHaveBeenCalledWith(mockResponse, ERROR_MESSAGES.INVALID_ID_FORMAT, 400);
    });

    it('should return false and send error for missing id', () => {
      const result = validateRequiredId(undefined, mockResponse);

      expect(result).toBe(false);
      expect(mockSendError).toHaveBeenCalledWith(mockResponse, 'ID is required', 400);
    });

    it('should use custom entity name in error message', () => {
      const invalidId = 'invalid-id';
      const entityName = 'User';

      const result = validateRequiredId(invalidId, mockResponse, entityName);

      expect(result).toBe(false);
      expect(mockSendError).toHaveBeenCalledWith(mockResponse, ERROR_MESSAGES.INVALID_ID_FORMAT, 400);
    });
  });

  describe('validatePaginationParams', () => {
    it('should return default pagination for missing params', () => {
      const result = validatePaginationParams();

      expect(result).toEqual({ page: 1, limit: 10 });
    });

    it('should return parsed pagination params', () => {
      const result = validatePaginationParams('2', '20');

      expect(result).toEqual({ page: 2, limit: 20 });
    });

    it('should handle invalid page number', () => {
      const result = validatePaginationParams('invalid', '10');

      expect(result).toEqual({ page: 1, limit: 10 });
    });

    it('should handle invalid limit', () => {
      const result = validatePaginationParams('1', 'invalid');

      expect(result).toEqual({ page: 1, limit: 10 });
    });

    it('should enforce minimum and maximum limits', () => {
      const result = validatePaginationParams('1', '1000');

      expect(result).toEqual({ page: 1, limit: 100 });
    });
  });

  describe('validateTimeRange', () => {
    beforeEach(() => {
      // Mock current time to a fixed value
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2023-01-01T12:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return true for valid time range', () => {
      const startTime = '2023-01-01T13:00:00Z';
      const endTime = '2023-01-01T14:00:00Z';
      
      const result = validateTimeRange(startTime, endTime, mockResponse);
      
      expect(result).toBe(true);
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should return false for invalid start time', () => {
      const startTime = 'invalid-date';
      const endTime = '2023-01-01T14:00:00Z';
      
      const result = validateTimeRange(startTime, endTime, mockResponse);
      
      expect(result).toBe(false);
      expect(mockSendError).toHaveBeenCalledWith(mockResponse, ERROR_MESSAGES.INVALID_DATE_FORMAT, 400);
    });

    it('should return false for invalid end time', () => {
      const startTime = '2023-01-01T13:00:00Z';
      const endTime = 'invalid-date';
      
      const result = validateTimeRange(startTime, endTime, mockResponse);
      
      expect(result).toBe(false);
      expect(mockSendError).toHaveBeenCalledWith(mockResponse, ERROR_MESSAGES.INVALID_DATE_FORMAT, 400);
    });

    it('should return false for past start time', () => {
      const startTime = '2023-01-01T11:00:00Z';
      const endTime = '2023-01-01T14:00:00Z';
      
      const result = validateTimeRange(startTime, endTime, mockResponse);
      
      expect(result).toBe(false);
      expect(mockSendError).toHaveBeenCalledWith(mockResponse, 'Cannot create booking in the past', 400);
    });

    it('should return false for end time before start time', () => {
      const startTime = '2023-01-01T14:00:00Z';
      const endTime = '2023-01-01T13:00:00Z';
      
      const result = validateTimeRange(startTime, endTime, mockResponse);
      
      expect(result).toBe(false);
      expect(mockSendError).toHaveBeenCalledWith(mockResponse, 'End time must be after start time', 400);
    });
  });

  describe('validateCoordinatesFromRequest', () => {
    it('should return true for valid coordinates', () => {
      const coordinates = { latitude: 52.3676, longitude: 4.9041 };
      
      const result = validateCoordinatesFromRequest(coordinates, mockResponse);
      
      expect(result).toBe(true);
      expect(mockValidateCoordinates).toHaveBeenCalledWith(52.3676, 4.9041);
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should return false for missing coordinates', () => {
      const result = validateCoordinatesFromRequest(null, mockResponse);
      
      expect(result).toBe(false);
      expect(mockSendError).toHaveBeenCalledWith(mockResponse, ERROR_MESSAGES.INVALID_COORDINATES_FORMAT, 400);
    });

    it('should return false for invalid coordinates', () => {
      const coordinates = { latitude: 'invalid', longitude: 4.9041 };
      mockValidateCoordinates.mockReturnValue(false);
      
      const result = validateCoordinatesFromRequest(coordinates, mockResponse);
      
      expect(result).toBe(false);
      expect(mockSendError).toHaveBeenCalledWith(mockResponse, 'Invalid coordinates format', 400);
    });
  });

  describe('validateLocationData', () => {
    it('should return empty array for valid location data', () => {
      const locationData = {
        name: 'Test Location',
        address: 'Test Address',
        coordinates: { latitude: 52.3676, longitude: 4.9041 }
      };
      
      const result = validateLocationData(locationData);
      
      expect(result).toEqual([]);
    });

    it('should return error for missing required fields', () => {
      const locationData = {
        name: 'Test Location',
        coordinates: { latitude: 52.3676, longitude: 4.9041 }
        // missing address
      };
      
      const result = validateLocationData(locationData);
      
      expect(result).toContain('Name and address are required');
    });

    it('should return error for invalid coordinates', () => {
      const locationData = {
        name: 'Test Location',
        address: 'Test Address',
        coordinates: { latitude: 'invalid', longitude: 4.9041 }
      };
      mockValidateCoordinates.mockReturnValue(false);
      
      const result = validateLocationData(locationData);
      
      expect(result).toContain('Invalid coordinates');
    });
  });

  describe('parseCoordinatesFromQuery', () => {
    it('should return coordinates for valid query params', () => {
      const mockReq = {
        query: { lat: '52.3676', lng: '4.9041' }
      } as unknown as Request;
      
      const result = parseCoordinatesFromQuery(mockReq);
      
      expect(result).toEqual({ latitude: 52.3676, longitude: 4.9041, radius: undefined });
    });

    it('should return undefined for missing coordinates', () => {
      const mockReq = {
        query: {}
      } as unknown as Request;
      
      const result = parseCoordinatesFromQuery(mockReq);
      
      expect(result).toEqual({ latitude: undefined, longitude: undefined, radius: undefined });
    });

    it('should handle invalid coordinates', () => {
      const mockReq = {
        query: { lat: 'invalid', lng: '4.9041' }
      } as unknown as Request;
      
      const result = parseCoordinatesFromQuery(mockReq);
      
      expect(result).toEqual({ latitude: NaN, longitude: 4.9041, radius: undefined });
    });
  });

  describe('validateCoordinatesFromQuery', () => {
    it('should return true for valid coordinates', () => {
      const result = validateCoordinatesFromQuery(52.3676, 4.9041, mockResponse);
      
      expect(result).toBe(true);
      expect(mockValidateCoordinates).toHaveBeenCalledWith(52.3676, 4.9041);
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should return false for missing coordinates', () => {
      const result = validateCoordinatesFromQuery(undefined, 4.9041, mockResponse);
      
      expect(result).toBe(false);
      expect(mockSendError).toHaveBeenCalledWith(mockResponse, 'Latitude and longitude are required', 400);
    });

    it('should return false for invalid coordinates', () => {
      mockValidateCoordinates.mockReturnValue(false);
      
      const result = validateCoordinatesFromQuery(52.3676, 4.9041, mockResponse);
      
      expect(result).toBe(false);
      expect(mockSendError).toHaveBeenCalledWith(mockResponse, 'Invalid coordinates', 400);
    });
  });

  describe('validateRequiredString', () => {
    it('should return null for valid string', () => {
      const result = validateRequiredString('test string', 'fieldName');
      
      expect(result).toBeNull();
    });

    it('should return error for empty string', () => {
      const result = validateRequiredString('', 'fieldName');
      
      expect(result).toBe('fieldName is required');
    });

    it('should return error for whitespace only string', () => {
      const result = validateRequiredString('   ', 'fieldName');
      
      expect(result).toBe('fieldName is required');
    });

    it('should return error for undefined value', () => {
      const result = validateRequiredString(undefined, 'fieldName');
      
      expect(result).toBe('fieldName is required');
    });
  });

  describe('validateEmail', () => {
    it('should return null for valid email', () => {
      const result = validateEmail('test@example.com');
      
      expect(result).toBeNull();
      expect(mockValidateEmailCore).toHaveBeenCalledWith('test@example.com');
    });

    it('should return error for undefined email', () => {
      const result = validateEmail(undefined as unknown as string);
      
      expect(result).toBe(ERROR_MESSAGES.EMAIL_REQUIRED);
    });

    it('should return error for empty email', () => {
      const result = validateEmail('');
      
      expect(result).toBe(ERROR_MESSAGES.EMAIL_REQUIRED);
    });

    it('should return error for whitespace only', () => {
      const result = validateEmail('   ');
      
      expect(result).toBe(ERROR_MESSAGES.EMAIL_REQUIRED);
    });

    it('should return error when core validation fails', () => {
      mockValidateEmailCore.mockReturnValue(false);
      
      const result = validateEmail('invalid-email');
      
      expect(result).toBe(ERROR_MESSAGES.INVALID_EMAIL_FORMAT);
    });
  });

  describe('validatePassword', () => {
    it('should return null for valid password', () => {
      const result = validatePassword('validpassword');
      
      expect(result).toBeNull();
      expect(mockValidatePasswordCore).toHaveBeenCalledWith('validpassword');
    });

    it('should return error for undefined password', () => {
      const result = validatePassword(undefined as unknown as string);
      
      expect(result).toBe(ERROR_MESSAGES.PASSWORD_REQUIRED);
    });

    it('should return error for empty password', () => {
      const result = validatePassword('');
      
      expect(result).toBe(ERROR_MESSAGES.PASSWORD_REQUIRED);
    });

    it('should return error for whitespace only', () => {
      const result = validatePassword('   ');
      
      expect(result).toBe(ERROR_MESSAGES.PASSWORD_REQUIRED);
    });

    it('should return error when core validation fails', () => {
      mockValidatePasswordCore.mockReturnValue(false);
      
      const result = validatePassword('short');
      
      expect(result).toBe('Password must be at least 6 characters long');
    });
  });

  describe('validateUserRole', () => {
    it('should return true for valid role', () => {
      const validRole = USER_ROLES[2]; // ADMIN

      const result = validateUserRole(validRole);

      expect(result).toBe(true);
    });

    it('should return false for invalid role', () => {
      const invalidRole = 'INVALID_ROLE';

      const result = validateUserRole(invalidRole);

      expect(result).toBe(false);
    });
  });

  describe('validateAuthentication', () => {
    it('should return true for valid userId', () => {
      const result = validateAuthentication('valid-user-id');

      expect(result).toBe(true);
    });

    it('should return false for undefined userId', () => {
      const result = validateAuthentication(undefined);

      expect(result).toBe(false);
    });

    it('should return false for empty string', () => {
      const result = validateAuthentication('');

      expect(result).toBe(false);
    });
  });

  describe('validateAdminRole', () => {
    it('should return true for admin user', () => {
      const user = { role: 'ADMIN' };
      
      const result = validateAdminRole(user, mockResponse);
      
      expect(result).toBe(true);
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should return false for non-admin user', () => {
      const user = { role: 'USER' };
      
      const result = validateAdminRole(user, mockResponse);
      
      expect(result).toBe(false);
      expect(mockSendError).toHaveBeenCalledWith(mockResponse, ERROR_MESSAGES.FORBIDDEN_ACCESS_DENIED, 403);
    });

    it('should return false for undefined user', () => {
      const result = validateAdminRole(undefined, mockResponse);
      
      expect(result).toBe(false);
      expect(mockSendError).toHaveBeenCalledWith(mockResponse, ERROR_MESSAGES.FORBIDDEN_ACCESS_DENIED, 403);
    });
  });

  describe('validateUserAuthentication', () => {
    it('should return true for valid userId', () => {
      const result = validateUserAuthentication('valid-user-id', mockResponse);
      
      expect(result).toBe(true);
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should return false for undefined userId', () => {
      const result = validateUserAuthentication(undefined, mockResponse);
      
      expect(result).toBe(false);
      expect(mockSendError).toHaveBeenCalledWith(mockResponse, ERROR_MESSAGES.USER_AUTH_REQUIRED, 401);
    });

    it('should return false for empty string', () => {
      const result = validateUserAuthentication('', mockResponse);
      
      expect(result).toBe(false);
      expect(mockSendError).toHaveBeenCalledWith(mockResponse, ERROR_MESSAGES.USER_AUTH_REQUIRED, 401);
    });
  });

  describe('validateBookingStatus', () => {
    it('should return true for valid booking status', () => {
      const validStatus = BOOKING_STATUSES[1]; // CONFIRMED

      const result = validateBookingStatus(validStatus);

      expect(result).toBe(true);
    });

    it('should return false for invalid booking status', () => {
      const invalidStatus = 'INVALID_STATUS';

      const result = validateBookingStatus(invalidStatus);

      expect(result).toBe(false);
    });
  });

  describe('validateDateParam', () => {
    it('should return Date for valid date string', () => {
      const result = validateDateParam('2023-01-01T12:00:00Z');
      
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(new Date('2023-01-01T12:00:00Z').getTime());
    });

    it('should return null for invalid date string', () => {
      const result = validateDateParam('invalid-date');
      
      expect(result).toBeNull();
    });

    it('should return null for undefined date', () => {
      const result = validateDateParam(undefined);
      
      expect(result).toBeNull();
    });
  });
}); 