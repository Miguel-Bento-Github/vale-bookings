import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authenticate, authorize } from '../../src/middleware/auth';
import * as AuthService from '../../src/services/AuthService';
import { AuthenticatedRequest, AppError, UserRole } from '../../src/types';

// Mock AuthService
jest.mock('../../src/services/AuthService');
const mockedAuthService = AuthService as jest.Mocked<typeof AuthService>;

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
    it('should authenticate with valid Bearer token', async () => {
      const mockPayload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'CUSTOMER' as UserRole
      };

      mockRequest.headers = {
        authorization: 'Bearer validtoken123'
      };

      mockedAuthService.verifyToken.mockReturnValue(mockPayload);

      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockedAuthService.verifyToken).toHaveBeenCalledWith('validtoken123');
      expect(mockRequest.user).toEqual(mockPayload);
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header is missing', async () => {
      mockRequest.headers = {};

      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockedAuthService.verifyToken).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header does not start with Bearer', async () => {
      mockRequest.headers = {
        authorization: 'Basic sometoken'
      };

      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockedAuthService.verifyToken).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header is just "Bearer "', async () => {
      mockRequest.headers = {
        authorization: 'Bearer '
      };

      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockedAuthService.verifyToken).not.toHaveBeenCalled();
    });

    it('should return 401 when token verification fails with generic error', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalidtoken'
      };

      mockedAuthService.verifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockedAuthService.verifyToken).toHaveBeenCalledWith('invalidtoken');
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });

    it('should handle AppError with custom status code and message', async () => {
      mockRequest.headers = {
        authorization: 'Bearer expiredtoken'
      };

      const appError = new AppError('Token expired', 403);
      mockedAuthService.verifyToken.mockImplementation(() => {
        throw appError;
      });

      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockedAuthService.verifyToken).toHaveBeenCalledWith('expiredtoken');
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Token expired'
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });

    it('should handle JWT errors specifically', async () => {
      mockRequest.headers = {
        authorization: 'Bearer malformedtoken'
      };

      mockedAuthService.verifyToken.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid signature');
      });

      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockedAuthService.verifyToken).toHaveBeenCalledWith('malformedtoken');
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should extract token correctly from authorization header', async () => {
      const mockPayload = {
        userId: 'user456',
        email: 'admin@example.com',
        role: 'ADMIN' as UserRole
      };

      mockRequest.headers = {
        authorization: 'Bearer abc123def456ghi789'
      };

      mockedAuthService.verifyToken.mockReturnValue(mockPayload);

      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockedAuthService.verifyToken).toHaveBeenCalledWith('abc123def456ghi789');
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

      const authorizeMiddleware = authorize(['ADMIN', 'MANAGER']);
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

      const authorizeMiddleware = authorize(['ADMIN', 'MANAGER']);
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

      const authorizeMiddleware = authorize(['admin']); // lowercase
      authorizeMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Forbidden: access denied'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('combined authentication and authorization flow', () => {
    it('should work correctly when chained together', async () => {
      const mockPayload = {
        userId: 'user123',
        email: 'admin@example.com',
        role: 'ADMIN' as UserRole
      };

      mockRequest.headers = {
        authorization: 'Bearer validtoken123'
      };

      mockedAuthService.verifyToken.mockReturnValue(mockPayload);

      // First apply authentication
      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      
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

    it('should fail authorization when authentication sets wrong role', async () => {
      const mockPayload = {
        userId: 'user123',
        email: 'customer@example.com',
        role: 'CUSTOMER' as UserRole
      };

      mockRequest.headers = {
        authorization: 'Bearer validtoken123'
      };

      mockedAuthService.verifyToken.mockReturnValue(mockPayload);

      // First apply authentication
      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      
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
    it('should handle undefined authorization header', async () => {
      mockRequest.headers = {
        authorization: undefined
      };

      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle empty string authorization header', async () => {
      mockRequest.headers = {
        authorization: ''
      };

      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle authorization header with only "Bearer"', async () => {
      mockRequest.headers = {
        authorization: 'Bearer'
      };

      await authenticate(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

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
        role: undefined as any
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
      mockRequest.user = null as any;

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