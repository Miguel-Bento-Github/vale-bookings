import { Response, NextFunction } from 'express';
import { JsonWebTokenError } from 'jsonwebtoken';
import request from 'supertest';

import app from '../../../src/app';
import { authenticate, authorize } from '../../../src/middleware/auth';
import { AuthenticatedRequest, AppError, UserRole } from '../../../src/types';
import * as TokenUtils from '../../../src/utils/tokenUtils';

// Mock TokenUtils
jest.mock('../../../src/utils/tokenUtils');
const mockedTokenUtils = TokenUtils as jest.Mocked<typeof TokenUtils>;

describe('Auth Middleware', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      user: undefined
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    mockNext = jest.fn();
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('authenticate middleware', () => {
    it('should authenticate with valid Bearer token', () => {
      const mockPayload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'CUSTOMER' as UserRole
      };

      mockRequest.headers = {
        authorization: 'Bearer validtoken123'
      };

      mockedTokenUtils.verifyTokenSafely.mockReturnValue(mockPayload);

      authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockedTokenUtils.verifyTokenSafely).toHaveBeenCalledWith('validtoken123');
      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header is missing', () => {
      mockRequest.headers = {};

      authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockedTokenUtils.verifyTokenSafely).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header does not start with Bearer', () => {
      mockRequest.headers = {
        authorization: 'Basic sometoken'
      };

      authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockedTokenUtils.verifyTokenSafely).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header is just "Bearer "', () => {
      mockRequest.headers = {
        authorization: 'Bearer '
      };

      authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockedTokenUtils.verifyTokenSafely).not.toHaveBeenCalled();
    });

    it('should return 401 when token verification fails with generic error', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalidtoken'
      };

      mockedTokenUtils.verifyTokenSafely.mockReturnValue(null);

      authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockedTokenUtils.verifyTokenSafely).toHaveBeenCalledWith('invalidtoken');
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token expired or invalid'
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });

    it('should handle AppError with custom status code and message', () => {
      mockRequest.headers = {
        authorization: 'Bearer expiredtoken'
      };

      const appError = new AppError('Token expired', 403);
      mockedTokenUtils.verifyTokenSafely.mockImplementation(() => {
        throw appError;
      });

      authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockedTokenUtils.verifyTokenSafely).toHaveBeenCalledWith('expiredtoken');
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token expired'
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });

    it('should handle JWT errors specifically', () => {
      mockRequest.headers = {
        authorization: 'Bearer malformedtoken'
      };

      mockedTokenUtils.verifyTokenSafely.mockImplementation(() => {
        throw new JsonWebTokenError('Invalid signature');
      });

      authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockedTokenUtils.verifyTokenSafely).toHaveBeenCalledWith('malformedtoken');
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should extract token correctly from authorization header', () => {
      const mockPayload = {
        userId: 'user456',
        email: 'admin@example.com',
        role: 'ADMIN' as UserRole
      };

      mockRequest.headers = {
        authorization: 'Bearer abc123def456ghi789'
      };

      mockedTokenUtils.verifyTokenSafely.mockReturnValue(mockPayload);

      authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockedTokenUtils.verifyTokenSafely).toHaveBeenCalledWith('abc123def456ghi789');
      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('authorize middleware', () => {
    it('should allow access when user has required role', () => {
      mockRequest.user = {
        userId: 'user123',
        email: 'admin@example.com',
        role: 'ADMIN' as UserRole
      };

      const authorizeMiddleware = authorize(['ADMIN', 'VALET']);
      authorizeMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should allow access when user has one of multiple required roles', () => {
      mockRequest.user = {
        userId: 'user123',
        email: 'customer@example.com',
        role: 'CUSTOMER' as UserRole
      };

      const authorizeMiddleware = authorize(['ADMIN', 'CUSTOMER', 'VALET']);
      authorizeMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should return 401 when user is not authenticated', () => {
      mockRequest.user = undefined;

      const authorizeMiddleware = authorize(['ADMIN']);
      authorizeMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user does not have required role', () => {
      mockRequest.user = {
        userId: 'user123',
        email: 'customer@example.com',
        role: 'CUSTOMER' as UserRole
      };

      const authorizeMiddleware = authorize(['ADMIN']);
      authorizeMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Forbidden: access denied'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 when user role is not in any of the required roles', () => {
      mockRequest.user = {
        userId: 'user123',
        email: 'valet@example.com',
        role: 'VALET' as UserRole
      };

      const authorizeMiddleware = authorize(['ADMIN', 'CUSTOMER']);
      authorizeMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Forbidden: access denied'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should work with empty roles array (deny all)', () => {
      mockRequest.user = {
        userId: 'user123',
        email: 'admin@example.com',
        role: 'ADMIN' as UserRole
      };

      const authorizeMiddleware = authorize([]);
      authorizeMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Forbidden: access denied'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should work with single role in array', () => {
      mockRequest.user = {
        userId: 'user123',
        email: 'admin@example.com',
        role: 'ADMIN' as UserRole
      };

      const authorizeMiddleware = authorize(['ADMIN']);
      authorizeMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should be case sensitive for role matching', () => {
      mockRequest.user = {
        userId: 'user123',
        email: 'admin@example.com',
        role: 'ADMIN' as UserRole
      };

      // Test with correct role - should succeed
      const authorizeMiddleware = authorize(['ADMIN']);
      authorizeMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });
  });

  describe('combined authentication and authorization flow', () => {
    it('should work correctly when chained together', () => {
      const mockPayload = {
        userId: 'user123',
        email: 'admin@example.com',
        role: 'ADMIN' as UserRole
      };

      mockRequest.headers = {
        authorization: 'Bearer validtoken123'
      };

      mockedTokenUtils.verifyTokenSafely.mockReturnValue(mockPayload);

      // First apply authentication
      authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRequest.user).toEqual(mockPayload);

      // Reset mockNext for authorization test
      jest.clearAllMocks();

      // Then apply authorization
      const authorizeMiddleware = authorize(['ADMIN']);
      authorizeMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should fail authorization when authentication sets wrong role', () => {
      const mockPayload = {
        userId: 'user123',
        email: 'customer@example.com',
        role: 'CUSTOMER' as UserRole
      };

      mockRequest.headers = {
        authorization: 'Bearer validtoken123'
      };

      mockedTokenUtils.verifyTokenSafely.mockReturnValue(mockPayload);

      // First apply authentication
      authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockRequest.user).toEqual(mockPayload);

      // Reset mocks for authorization test
      jest.clearAllMocks();

      // Then apply authorization requiring ADMIN role
      const authorizeMiddleware = authorize(['ADMIN']);
      authorizeMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Forbidden: access denied'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle undefined authorization header', () => {
      mockRequest.headers = {
        authorization: undefined
      };

      authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle empty string authorization header', () => {
      mockRequest.headers = {
        authorization: ''
      };

      authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle authorization header with only "Bearer"', () => {
      mockRequest.headers = {
        authorization: 'Bearer'
      };

      authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle user object with missing role property', () => {
      mockRequest.user = {
        userId: 'user123',
        email: 'test@example.com',
        role: undefined as unknown as UserRole
      };

      const authorizeMiddleware = authorize(['ADMIN']);
      authorizeMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Forbidden: access denied'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle null user object', () => {
      mockRequest.user = undefined;

      const authorizeMiddleware = authorize(['ADMIN']);
      authorizeMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});

describe('Middleware Tests', () => {
  describe('JSON Parsing Middleware', () => {
    it('should handle malformed JSON with 400 status', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('{"email": "test@example.com", "password": "password123", ' +
          '"profile": {"name": "Test User"}') // Missing brace
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid JSON payload',
        errorCode: 'BAD_REQUEST'
      });
    });

    it('should handle empty JSON body', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid JSON payload',
        errorCode: 'BAD_REQUEST'
      });
    });

    it('should handle non-JSON content type', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'text/plain')
        .send('not json')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid content type',
        errorCode: 'BAD_REQUEST'
      });
    });
  });

  describe('Error Handling Middleware', () => {
    it('should handle AppError with custom status code', async () => {
      const response = await request(app)
        .get('/api/test-error')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Test error'
      });
    });

    it('should handle unknown errors with 500 status', async () => {
      const response = await request(app)
        .get('/api/test-unknown-error')
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Internal server error'
      });
    });
  });
}); 