import { Request, Response } from 'express';

import { AuthenticatedRequest } from '../types';

import {
  sendSuccess,
  sendError,
  sendSuccessWithPagination,
  withErrorHandling
} from './responseHelpers';
import {
  validateRequiredId,
  validatePaginationParams,
  validateUserRole,
  validateAuthentication
} from './validationHelpers';

export interface CrudService<T, CreateData, UpdateData> {
    getAll?: (options?: { page?: number; limit?: number }) => Promise<T[]>;
    getById: (id: string) => Promise<T | null>;
    create: (data: CreateData) => Promise<T>;
    update: (id: string, data: UpdateData) => Promise<T | null>;
    delete: (id: string) => Promise<void>;
}

export interface CrudOptions {
    requireAuth?: boolean;
    requiredRole?: string;
    entityName?: string;
}

export function createCrudController<T, CreateData, UpdateData>(
  service: CrudService<T, CreateData, UpdateData>,
  options: CrudOptions = {}
) {
  const entityName = options.entityName ?? 'Resource';

  const getAll = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
    if (options.requireAuth === true) {
      const authReq = req as AuthenticatedRequest;
      if (!validateAuthentication(authReq.user, res)) {
        return;
      }
    }

    if (options.requiredRole && options.requiredRole.length > 0) {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user || !validateUserRole(authReq.user.role, options.requiredRole, res)) {
        return;
      }
    }

    if (service.getAll) {
      const { page, limit } = validatePaginationParams(
                req.query.page as string,
                req.query.limit as string
      );

      const items = await service.getAll({ page, limit });
      sendSuccess(res, items);
    } else {
      sendError(res, 'Operation not supported', 501);
    }
  });

  const getById = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;

    if (!validateRequiredId(id, res, `${entityName} ID`)) {
      return;
    }

    const item = await service.getById(id as string);

    if (!item) {
      sendError(res, `${entityName} not found`, 404);
      return;
    }

    sendSuccess(res, item);
  });

  const create = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
    if (options.requireAuth === true) {
      const authReq = req as AuthenticatedRequest;
      if (!validateAuthentication(authReq.user, res)) {
        return;
      }
    }

    if (options.requiredRole && options.requiredRole.length > 0) {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user || !validateUserRole(authReq.user.role, options.requiredRole, res)) {
        return;
      }
    }

    const item = await service.create(req.body as CreateData);
    sendSuccess(res, item, `${entityName} created successfully`, 201);
  });

  const update = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
    if (options.requireAuth === true) {
      const authReq = req as AuthenticatedRequest;
      if (!validateAuthentication(authReq.user, res)) {
        return;
      }
    }

    if (options.requiredRole && options.requiredRole.length > 0) {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user || !validateUserRole(authReq.user.role, options.requiredRole, res)) {
        return;
      }
    }

    const { id } = req.params;
    if (!validateRequiredId(id, res, `${entityName} ID`)) {
      return;
    }

    const item = await service.update(id as string, req.body as UpdateData);
    if (!item) {
      sendError(res, `${entityName} not found`, 404);
      return;
    }

    sendSuccess(res, item, `${entityName} updated successfully`);
  });

  const deleteItem = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
    if (options.requireAuth === true) {
      const authReq = req as AuthenticatedRequest;
      if (!validateAuthentication(authReq.user, res)) {
        return;
      }
    }

    if (options.requiredRole && options.requiredRole.length > 0) {
      const authReq = req as AuthenticatedRequest;
      if (!authReq.user || !validateUserRole(authReq.user.role, options.requiredRole, res)) {
        return;
      }
    }

    const { id } = req.params;
    if (!validateRequiredId(id, res, `${entityName} ID`)) {
      return;
    }

    await service.delete(id as string);
    sendSuccess(res, undefined, `${entityName} deleted successfully`);
  });

  return {
    getAll,
    getById,
    create,
    update,
    delete: deleteItem
  };
} 