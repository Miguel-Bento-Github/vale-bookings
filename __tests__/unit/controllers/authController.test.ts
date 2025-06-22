// Mock User model (declare with var for hoisting)
var mockFindById = jest.fn();
var mockFindByIdAndDelete = jest.fn();
var mockFind = jest.fn();

jest.doMock('../../../src/models/User', () => ({
  __esModule: true,
  default: {
    findById: mockFindById,
    findByIdAndDelete: mockFindByIdAndDelete,
    find: mockFind
  }
}));

import { Request, Response } from 'express';
import bcryptjs from 'bcryptjs';
import { UserRole } from '../../../src/types';

// Controller functions will be assigned after import
let me: typeof import('../../../src/controllers/AuthController').me;
let changePassword: typeof import('../../../src/controllers/AuthController').changePassword;
let deleteAccount: typeof import('../../../src/controllers/AuthController').deleteAccount;
let getAllUsers: typeof import('../../../src/controllers/AuthController').getAllUsers;
let deleteUser: typeof import('../../../src/controllers/AuthController').deleteUser;

// Mock bcryptjs
jest.mock('bcryptjs');

// Mock sendSuccess and sendError
jest.mock('../../../src/utils/responseHelpers', () => ({
  sendSuccess: (res: Response, data?: unknown, message?: string, status = 200): void => {
    res.status(status).json({ success: true, message, data });
  },
  sendError: (res: Response, message: string, status = 500): void => {
    res.status(status).json({ success: false, message });
  },
  withErrorHandling: (fn: unknown): unknown => fn
}));

interface TestAuthenticatedRequest extends Request {
  user: {
    userId: string;
    email: string;
    role: UserRole;
  };
}

describe('AuthController Extended Tests', () => {
  beforeAll(async () => {
    // Import controller after mocks are set up
    const controller = await import('../../../src/controllers/AuthController');
    me = controller.me;
    changePassword = controller.changePassword;
    deleteAccount = controller.deleteAccount;
    getAllUsers = controller.getAllUsers;
    deleteUser = controller.deleteUser;
  });

  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockAuthenticatedRequest: TestAuthenticatedRequest;

  beforeEach(() => {
    mockRequest = {
      body: {},
      params: {},
      query: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockAuthenticatedRequest = {
      ...mockRequest,
      user: {
        userId: '507f1f77bcf86cd799439012',
        email: 'test@example.com',
        role: 'CUSTOMER' as UserRole
      }
    } as TestAuthenticatedRequest;

    jest.clearAllMocks();
  });

  describe('me', () => {
    it('should get current user profile successfully', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439012',
        email: 'test@example.com',
        role: 'CUSTOMER',
        profile: { name: 'Test User' }
      };
      mockFindById.mockResolvedValueOnce(mockUser);
      await me(mockAuthenticatedRequest as unknown as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: {
            _id: String(mockUser._id),
            email: mockUser.email,
            role: mockUser.role,
            profile: mockUser.profile
          }
        }
      });
    });
    it('should return 401 for missing user ID', async () => {
      const requestWithoutUser = { ...mockRequest } as Request;
      await me(requestWithoutUser as unknown as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User authentication required'
      });
    });
    it('should return 401 for empty user ID', async () => {
      const requestWithEmptyUser = {
        ...mockRequest,
        user: { userId: '', email: 'test@example.com', role: 'CUSTOMER' as UserRole }
      } as TestAuthenticatedRequest;
      await me(requestWithEmptyUser as unknown as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User authentication required'
      });
    });
    it('should return 401 for non-existent user', async () => {
      mockFindById.mockResolvedValueOnce(null);
      await me(mockAuthenticatedRequest as unknown as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439012',
        email: 'test@example.com',
        password: '$2a$12$hashedPassword',
        save: jest.fn().mockResolvedValue(true)
      };
      const mockSelect = jest.fn().mockResolvedValue(mockUser);
      mockFindById.mockReturnValueOnce({ select: mockSelect });
      jest.spyOn(bcryptjs, 'compare').mockImplementation(() => Promise.resolve(true));
      jest.spyOn(bcryptjs, 'hash').mockImplementation(() => Promise.resolve('$2a$12$newHashedPassword'));
      mockAuthenticatedRequest.body = {
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword123'
      };
      await changePassword(mockAuthenticatedRequest as unknown as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password changed successfully'
      });
      expect(bcryptjs.compare).toHaveBeenCalledWith('oldPassword123', '$2a$12$hashedPassword');
      expect(bcryptjs.hash).toHaveBeenCalledWith('newPassword123', 12);
      expect(mockUser.save).toHaveBeenCalled();
    });
    it('should return 401 for missing user ID', async () => {
      const requestWithoutUser = { ...mockRequest } as Request;
      await changePassword(requestWithoutUser as unknown as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User authentication required'
      });
    });
    it('should return 401 for empty user ID', async () => {
      const requestWithEmptyUser = {
        ...mockRequest,
        user: { userId: '', email: 'test@example.com', role: 'CUSTOMER' as UserRole }
      } as TestAuthenticatedRequest;
      await changePassword(requestWithEmptyUser as unknown as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User authentication required'
      });
    });
    it('should return 401 for non-existent user', async () => {
      const mockSelect = jest.fn().mockResolvedValue(null);
      mockFindById.mockReturnValueOnce({ select: mockSelect });
      mockAuthenticatedRequest.body = {
        currentPassword: 'oldPassword123',
        newPassword: 'newPassword123'
      };
      await changePassword(mockAuthenticatedRequest as unknown as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User not found'
      });
    });
    it('should return 400 for incorrect current password', async () => {
      const mockUser = {
        _id: '507f1f77bcf86cd799439012',
        email: 'test@example.com',
        password: '$2a$12$hashedPassword'
      };
      const mockSelect = jest.fn().mockResolvedValue(mockUser);
      mockFindById.mockReturnValueOnce({ select: mockSelect });
      jest.spyOn(bcryptjs, 'compare').mockImplementation(() => Promise.resolve(false));
      mockAuthenticatedRequest.body = {
        currentPassword: 'wrongPassword',
        newPassword: 'newPassword123'
      };
      await changePassword(mockAuthenticatedRequest as unknown as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Current password is incorrect'
      });
    });
  });

  describe('deleteAccount', () => {
    it('should delete account successfully', async () => {
      mockFindByIdAndDelete.mockResolvedValueOnce({ _id: '507f1f77bcf86cd799439012' });
      await deleteAccount(mockAuthenticatedRequest as unknown as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Account deleted successfully'
      });
      expect(mockFindByIdAndDelete).toHaveBeenCalledWith('507f1f77bcf86cd799439012');
    });
    it('should return 401 for missing user ID', async () => {
      const requestWithoutUser = { ...mockRequest } as Request;
      await deleteAccount(requestWithoutUser as unknown as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User authentication required'
      });
    });
    it('should return 401 for empty user ID', async () => {
      const requestWithEmptyUser = {
        ...mockRequest,
        user: { userId: '', email: 'test@example.com', role: 'CUSTOMER' as UserRole }
      } as TestAuthenticatedRequest;
      await deleteAccount(requestWithEmptyUser as unknown as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User authentication required'
      });
    });
  });

  describe('getAllUsers', () => {
    it('should get all users successfully', async () => {
      const mockUsers = [
        { _id: '1', email: 'user1@example.com', role: 'CUSTOMER' },
        { _id: '2', email: 'user2@example.com', role: 'ADMIN' }
      ];
      mockFind.mockResolvedValueOnce(mockUsers);
      await getAllUsers(mockRequest as unknown as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockUsers
      });
      expect(mockFind).toHaveBeenCalledWith({}, '-password');
    });
  });

  describe('deleteUser', () => {
    it('should delete user successfully', async () => {
      const userId = '507f1f77bcf86cd799439012';
      mockRequest.params = { id: userId };
      mockFindByIdAndDelete.mockResolvedValueOnce({ _id: userId });
      await deleteUser(mockRequest as unknown as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'User deleted successfully'
      });
      expect(mockFindByIdAndDelete).toHaveBeenCalledWith(userId);
    });
    it('should return 400 for missing user ID', async () => {
      mockRequest.params = {};
      await deleteUser(mockRequest as unknown as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'User ID is required'
      });
    });
    it('should return 400 for invalid user ID format', async () => {
      mockRequest.params = { id: 'invalid-id' };
      await deleteUser(mockRequest as unknown as Request, mockResponse as Response);
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid ID format'
      });
    });
  });
}); 