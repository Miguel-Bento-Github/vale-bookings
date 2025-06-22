import { Response, Request } from 'express';

import { AppError } from '../../../src/types';
import {
  sendSuccess,
  sendError,
  sendSuccessWithPagination,
  handleControllerError,
  withErrorHandling,
  PaginationMeta
} from '../../../src/utils/responseHelpers';

// Mock Response object
const createMockResponse = (): Partial<Response> => {
  const mockRes = {
    status: jest.fn(),
    json: jest.fn()
  };
  mockRes.status.mockReturnValue(mockRes);
  mockRes.json.mockReturnValue(mockRes);
  return mockRes;
};

// Mock Request object
const createMockRequest = (): Partial<Request> => ({
  body: {},
  params: {},
  query: {}
});

describe('responseHelpers', () => {
  let mockRes: Partial<Response>;
  let mockReq: Partial<Request>;

  beforeEach(() => {
    mockRes = createMockResponse();
    mockReq = createMockRequest();
  });

  describe('sendSuccess', () => {
    it('should send success response with data', () => {
      const data = { id: '1', name: 'Test' };
      const result = sendSuccess(mockRes as Response, data);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data
      });
      expect(result).toBe(mockRes);
    });

    it('should send success response with custom message', () => {
      const data = { id: '1' };
      const message = 'Custom success message';
      const result = sendSuccess(mockRes as Response, data, message);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
        message
      });
      expect(result).toBe(mockRes);
    });

    it('should send success response with custom status code', () => {
      const data = { id: '1' };
      const result = sendSuccess(mockRes as Response, data, undefined, 201);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data
      });
      expect(result).toBe(mockRes);
    });

    it('should send success response with message and status code', () => {
      const data = { id: '1' };
      const message = 'Created successfully';
      const result = sendSuccess(mockRes as Response, data, message, 201);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
        message
      });
      expect(result).toBe(mockRes);
    });
  });

  describe('sendError', () => {
    it('should send error response with message', () => {
      const message = 'Test error message';
      const result = sendError(mockRes as Response, message);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message
      });
      expect(result).toBe(mockRes);
    });

    it('should send error response with custom status code', () => {
      const message = 'Not found';
      const result = sendError(mockRes as Response, message, 404);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message
      });
      expect(result).toBe(mockRes);
    });

    it('should send error response with error details', () => {
      const message = 'Validation failed';
      const error = 'Invalid email format';
      const result = sendError(mockRes as Response, message, 400, error);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message,
        error
      });
      expect(result).toBe(mockRes);
    });
  });

  describe('sendSuccessWithPagination', () => {
    it('should send success response with pagination', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const pagination: PaginationMeta = {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3
      };
      
      sendSuccessWithPagination(mockRes as Response, data, pagination);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
        pagination
      });
    });

    it('should include message when provided', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const pagination: PaginationMeta = {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3
      };
      const message = 'Resources retrieved successfully';
      
      sendSuccessWithPagination(mockRes as Response, data, pagination, message);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
        pagination,
        message
      });
    });

    it('should not include message when empty string', () => {
      const data = [{ id: '1' }, { id: '2' }];
      const pagination: PaginationMeta = {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3
      };
      
      sendSuccessWithPagination(mockRes as Response, data, pagination, '');

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
        pagination
      });
    });
  });

  describe('handleControllerError', () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it('should handle AppError correctly', () => {
      const appError = new AppError('Custom error message', 400);
      
      handleControllerError(appError, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Custom error message'
      });
    });

    it('should handle regular Error correctly', () => {
      const error = new Error('Unexpected error');
      
      handleControllerError(error, mockRes as Response);

      expect(consoleSpy).toHaveBeenCalledWith('Unexpected error:', error);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });

    it('should handle unknown error types', () => {
      const unknownError = 'String error';
      
      handleControllerError(unknownError, mockRes as Response);

      expect(consoleSpy).toHaveBeenCalledWith('Unknown error:', unknownError);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });

    it('should handle null error', () => {
      handleControllerError(null, mockRes as Response);

      expect(consoleSpy).toHaveBeenCalledWith('Unknown error:', null);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });

    it('should handle undefined error', () => {
      handleControllerError(undefined, mockRes as Response);

      expect(consoleSpy).toHaveBeenCalledWith('Unknown error:', undefined);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });
  });

  describe('withErrorHandling', () => {
    it('should execute function and return result on success', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      const wrappedFn = withErrorHandling(mockFn);

      await wrappedFn(mockReq as Request, mockRes as Response);

      expect(mockFn).toHaveBeenCalledWith(mockReq, mockRes);
    });

    it('should handle AppError and send error response', async () => {
      const error = new AppError('Test error', 400);
      const mockFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = withErrorHandling(mockFn);

      await wrappedFn(mockReq as Request, mockRes as Response);

      expect(mockFn).toHaveBeenCalledWith(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Test error'
      });
    });

    it('should handle generic errors and send 500 response', async () => {
      const error = new Error('Generic error');
      const mockFn = jest.fn().mockRejectedValue(error);
      const wrappedFn = withErrorHandling(mockFn);

      await wrappedFn(mockReq as Request, mockRes as Response);

      expect(mockFn).toHaveBeenCalledWith(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });

    it('should handle synchronous errors', async () => {
      const error = new Error('Sync error');
      const mockFn = jest.fn().mockImplementation(() => {
        throw error;
      });
      const wrappedFn = withErrorHandling(mockFn);

      await wrappedFn(mockReq as Request, mockRes as Response);

      expect(mockFn).toHaveBeenCalledWith(mockReq, mockRes);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: 'Internal server error'
      });
    });
  });
}); 