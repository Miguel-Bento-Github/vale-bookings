import { Request, Response } from 'express';

import { AuthenticatedRequest } from '../../../src/types';
import { createCrudController, CrudService, CrudOptions } from '../../../src/utils/baseController';
import { sendSuccess, sendError } from '../../../src/utils/responseHelpers';
import {
  validateRequiredId,
  validatePaginationParams,
  validateUserRole,
  validateAuthentication
} from '../../../src/utils/validationHelpers';

// Mock the dependencies
jest.mock('../../../src/utils/responseHelpers', () => ({
  sendSuccess: jest.fn(),
  sendError: jest.fn(),
  withErrorHandling: jest.fn((fn: unknown) => fn)
}));

jest.mock('../../../src/utils/validationHelpers', () => ({
  validateRequiredId: jest.fn(),
  validatePaginationParams: jest.fn(),
  validateUserRole: jest.fn(),
  validateAuthentication: jest.fn()
}));

const mockSendSuccess = sendSuccess as jest.MockedFunction<typeof sendSuccess>;
const mockSendError = sendError as jest.MockedFunction<typeof sendError>;
const mockValidateRequiredId = validateRequiredId as jest.MockedFunction<typeof validateRequiredId>;
const mockValidatePaginationParams = validatePaginationParams as jest.MockedFunction<typeof validatePaginationParams>;
const mockValidateUserRole = validateUserRole as jest.MockedFunction<typeof validateUserRole>;
const mockValidateAuthentication = validateAuthentication as jest.MockedFunction<typeof validateAuthentication>;

type TestRequest = Partial<Request>;
type TestResponse = Partial<Response>;
type TestAuthRequest = Partial<AuthenticatedRequest>;

interface TestEntity {
  id: string;
  name?: string;
}

describe('baseController', () => {
  let mockService: CrudService<TestEntity, TestEntity, TestEntity>;
  let mockReq: TestRequest;
  let mockRes: TestResponse;
  let mockAuthReq: TestAuthRequest;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockService = {
      getAll: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    };

    mockReq = {
      params: {},
      query: {},
      body: {}
    };

    mockRes = {};

    mockAuthReq = {
      params: {},
      query: {},
      body: {},
      user: {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'ADMIN'
      }
    };

    // Default mock implementations
    mockValidateRequiredId.mockReturnValue(true);
    mockValidatePaginationParams.mockReturnValue({ page: 1, limit: 10 });
    mockValidateUserRole.mockReturnValue(true);
    mockValidateAuthentication.mockReturnValue(true);
  });

  describe('createCrudController', () => {
    it('should create a controller with all CRUD operations', () => {
      const controller = createCrudController(mockService);

      expect(controller).toHaveProperty('getAll');
      expect(controller).toHaveProperty('getById');
      expect(controller).toHaveProperty('create');
      expect(controller).toHaveProperty('update');
      expect(controller).toHaveProperty('delete');
    });

    it('should handle getAll operation', async () => {
      const mockData = [{ id: '1' }, { id: '2' }];
      (mockService.getAll as jest.Mock).mockResolvedValue(mockData);
      mockSendSuccess.mockReturnValue({} as Response);

      const controller = createCrudController(mockService);
      await controller.getAll(mockReq as Request, mockRes as Response);

      expect(mockService.getAll).toHaveBeenCalled();
      expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockData);
    });

    it('should handle getById operation', async () => {
      const mockData = { id: '1' };
      (mockService.getById as jest.Mock).mockResolvedValue(mockData);
      mockSendSuccess.mockReturnValue({} as Response);

      const controller = createCrudController(mockService);
      mockReq.params = { id: '1' };
      await controller.getById(mockReq as Request, mockRes as Response);

      expect(mockService.getById).toHaveBeenCalledWith('1');
      expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockData);
    });

    it('should handle create operation', async () => {
      const mockData = { id: '1', name: 'Test' };
      (mockService.create as jest.Mock).mockResolvedValue(mockData);

      const controller = createCrudController(mockService);
      mockReq.body = { name: 'Test' };
      await controller.create(mockReq as Request, mockRes as Response);

      expect(mockService.create).toHaveBeenCalledWith({ name: 'Test' });
      expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockData, 'Resource created successfully', 201);
    });

    it('should handle update operation', async () => {
      const mockData = { id: '1', name: 'Updated' };
      (mockService.update as jest.Mock).mockResolvedValue(mockData);

      const controller = createCrudController(mockService);
      mockReq.params = { id: '1' };
      mockReq.body = { name: 'Updated' };
      await controller.update(mockReq as Request, mockRes as Response);

      expect(mockService.update).toHaveBeenCalledWith('1', { name: 'Updated' });
      expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockData, 'Resource updated successfully');
    });

    it('should handle delete operation', async () => {
      (mockService.delete as jest.Mock).mockResolvedValue(undefined);

      const controller = createCrudController(mockService);
      mockReq.params = { id: '1' };
      await controller.delete(mockReq as Request, mockRes as Response);

      expect(mockService.delete).toHaveBeenCalledWith('1');
      expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, undefined, 'Resource deleted successfully');
    });
  });

  describe('getAll', () => {
    it('should call service.getAll when available', async () => {
      const mockItems = [{ id: '1', name: 'Test' }];
      mockService.getAll = jest.fn().mockResolvedValue(mockItems);
      
      const controller = createCrudController(mockService);
      await controller.getAll(mockReq as Request, mockRes as Response);
      
      expect(mockService.getAll).toHaveBeenCalledWith({ page: 1, limit: 10 });
      expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockItems);
    });

    it('should return 501 when getAll is not available', async () => {
      const serviceWithoutGetAll = { ...mockService };
      delete serviceWithoutGetAll.getAll;
      
      const controller = createCrudController(serviceWithoutGetAll);
      await controller.getAll(mockReq as Request, mockRes as Response);
      
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Operation not supported', 501);
    });

    it('should require authentication when requireAuth is true', async () => {
      const options: CrudOptions = { requireAuth: true };
      const controller = createCrudController(mockService, options);
      
      // Test without authentication
      mockValidateAuthentication.mockReturnValue(false);
      await controller.getAll(mockReq as Request, mockRes as Response);
      
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Authentication required', 401);
    });

    it('should require specific role when requiredRole is provided', async () => {
      const options: CrudOptions = { requiredRole: 'ADMIN' };
      const controller = createCrudController(mockService, options);
      
      // Test without proper role
      mockValidateUserRole.mockReturnValue(false);
      await controller.getAll(mockAuthReq as AuthenticatedRequest, mockRes as Response);
      
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Insufficient permissions', 403);
    });

    it('should allow access when user has required role', async () => {
      const options: CrudOptions = { requiredRole: 'ADMIN' };
      const mockItems = [{ id: '1', name: 'Test' }];
      mockService.getAll = jest.fn().mockResolvedValue(mockItems);
      
      const controller = createCrudController(mockService, options);
      await controller.getAll(mockAuthReq as AuthenticatedRequest, mockRes as Response);
      
      expect(mockService.getAll).toHaveBeenCalled();
      expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockItems);
    });
  });

  describe('getById', () => {
    it('should call service.getById and return item when found', async () => {
      const mockItem = { id: '1', name: 'Test' };
      mockService.getById = jest.fn().mockResolvedValue(mockItem);
      
      const controller = createCrudController(mockService);
      await controller.getById(mockReq as Request, mockRes as Response);
      
      expect(mockService.getById).toHaveBeenCalledWith(undefined);
      expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockItem);
    });

    it('should return 404 when item not found', async () => {
      mockService.getById = jest.fn().mockResolvedValue(null);
      
      const controller = createCrudController(mockService);
      await controller.getById(mockReq as Request, mockRes as Response);
      
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Resource not found', 404);
    });

    it('should return early when ID validation fails', async () => {
      mockValidateRequiredId.mockReturnValue(false);
      
      const controller = createCrudController(mockService);
      await controller.getById(mockReq as Request, mockRes as Response);
      
      expect(mockService.getById).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should call service.create and return created item', async () => {
      const mockItem = { id: '1', name: 'Test' };
      (mockService.create as jest.Mock).mockResolvedValue(mockItem);
      
      const controller = createCrudController(mockService);
      await controller.create(mockReq as Request, mockRes as Response);
      
      expect(mockService.create).toHaveBeenCalledWith({});
      expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockItem, 'Resource created successfully', 201);
    });

    it('should require authentication when requireAuth is true', async () => {
      const options: CrudOptions = { requireAuth: true };
      const controller = createCrudController(mockService, options);
      
      mockValidateAuthentication.mockReturnValue(false);
      await controller.create(mockReq as Request, mockRes as Response);
      
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Authentication required', 401);
    });

    it('should require specific role when requiredRole is provided', async () => {
      const options: CrudOptions = { requiredRole: 'ADMIN' };
      const controller = createCrudController(mockService, options);
      
      mockValidateUserRole.mockReturnValue(false);
      await controller.create(mockAuthReq as AuthenticatedRequest, mockRes as Response);
      
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Insufficient permissions', 403);
    });
  });

  describe('update', () => {
    it('should call service.update and return updated item', async () => {
      const mockItem = { id: '1', name: 'Updated Test' };
      (mockService.update as jest.Mock).mockResolvedValue(mockItem);
      
      const controller = createCrudController(mockService);
      await controller.update(mockReq as Request, mockRes as Response);
      
      expect(mockService.update).toHaveBeenCalledWith(undefined, {});
      expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockItem, 'Resource updated successfully');
    });

    it('should return 404 when item not found', async () => {
      (mockService.update as jest.Mock).mockResolvedValue(null);
      
      const controller = createCrudController(mockService);
      await controller.update(mockReq as Request, mockRes as Response);
      
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Resource not found', 404);
    });

    it('should return early when ID validation fails', async () => {
      mockValidateRequiredId.mockReturnValue(false);
      
      const controller = createCrudController(mockService);
      await controller.update(mockReq as Request, mockRes as Response);
      
      expect(mockService.update).not.toHaveBeenCalled();
    });

    it('should require authentication when requireAuth is true', async () => {
      const options: CrudOptions = { requireAuth: true };
      const controller = createCrudController(mockService, options);
      
      mockValidateAuthentication.mockReturnValue(false);
      await controller.update(mockReq as Request, mockRes as Response);
      
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Authentication required', 401);
    });
  });

  describe('delete', () => {
    it('should call service.delete and return success message', async () => {
      (mockService.delete as jest.Mock).mockResolvedValue(undefined);
      
      const controller = createCrudController(mockService);
      await controller.delete(mockReq as Request, mockRes as Response);
      
      expect(mockService.delete).toHaveBeenCalledWith(undefined);
      expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, undefined, 'Resource deleted successfully');
    });

    it('should return early when ID validation fails', async () => {
      mockValidateRequiredId.mockReturnValue(false);
      
      const controller = createCrudController(mockService);
      await controller.delete(mockReq as Request, mockRes as Response);
      
      expect(mockService.delete).not.toHaveBeenCalled();
    });

    it('should require authentication when requireAuth is true', async () => {
      const options: CrudOptions = { requireAuth: true };
      const controller = createCrudController(mockService, options);
      
      mockValidateAuthentication.mockReturnValue(false);
      await controller.delete(mockReq as Request, mockRes as Response);
      
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Authentication required', 401);
    });

    it('should require specific role when requiredRole is provided', async () => {
      const options: CrudOptions = { requiredRole: 'ADMIN' };
      const controller = createCrudController(mockService, options);
      
      mockValidateUserRole.mockReturnValue(false);
      await controller.delete(mockAuthReq as AuthenticatedRequest, mockRes as Response);
      
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Insufficient permissions', 403);
    });
  });

  describe('edge cases', () => {
    it('should handle undefined user in authenticated request', async () => {
      const options: CrudOptions = { requiredRole: 'ADMIN' };
      const controller = createCrudController(mockService, options);
      
      const reqWithoutUser = { ...mockAuthReq, user: undefined };
      await controller.getAll(reqWithoutUser as AuthenticatedRequest, mockRes as Response);
      
      expect(mockSendError).toHaveBeenCalledWith(mockRes, 'Insufficient permissions', 403);
    });

    it('should handle empty requiredRole', async () => {
      const options: CrudOptions = { requiredRole: '' };
      const mockItems = [{ id: '1', name: 'Test' }];
      mockService.getAll = jest.fn().mockResolvedValue(mockItems);
      
      const controller = createCrudController(mockService, options);
      await controller.getAll(mockAuthReq as AuthenticatedRequest, mockRes as Response);
      
      expect(mockService.getAll).toHaveBeenCalled();
      expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockItems);
    });

    it('should handle undefined requiredRole', async () => {
      const options: CrudOptions = { requiredRole: undefined };
      const mockItems = [{ id: '1', name: 'Test' }];
      mockService.getAll = jest.fn().mockResolvedValue(mockItems);
      
      const controller = createCrudController(mockService, options);
      await controller.getAll(mockAuthReq as AuthenticatedRequest, mockRes as Response);
      
      expect(mockService.getAll).toHaveBeenCalled();
      expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockItems);
    });
  });
}); 