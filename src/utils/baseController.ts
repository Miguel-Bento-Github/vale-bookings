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

export class BaseCrudController<T, CreateData, UpdateData> {
    constructor(
        private service: CrudService<T, CreateData, UpdateData>,
        private options: CrudOptions = {}
    ) { }

    private validateAccess(req: AuthenticatedRequest, res: Response): boolean {
        if (this.options.requireAuth && !validateAuthentication(req.user?.userId, res)) {
            return false;
        }

        if (this.options.requiredRole && !validateUserRole(req.user?.role, this.options.requiredRole, res)) {
            return false;
        }

        return true;
    }

    getAll = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
        if (!this.service.getAll) {
            sendError(res, 'Operation not supported', 404);
            return;
        }

        const { page, limit } = validatePaginationParams(req.query.page as string, req.query.limit as string);
        const items = await this.service.getAll({ page, limit });

        sendSuccess(res, items);
    });

    getById = withErrorHandling(async (req: Request, res: Response): Promise<void> => {
        const { id } = req.params;

        if (!validateRequiredId(id, res, `${this.options.entityName || 'Item'} ID`)) {
            return;
        }

        const item = await this.service.getById(id!);

        if (!item) {
            sendError(res, `${this.options.entityName || 'Item'} not found`, 404);
            return;
        }

        sendSuccess(res, item);
    });

    create = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        if (!this.validateAccess(req, res)) {
            return;
        }

        const item = await this.service.create(req.body as CreateData);
        sendSuccess(res, item, `${this.options.entityName || 'Item'} created successfully`, 201);
    });

    update = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;

        if (!this.validateAccess(req, res)) {
            return;
        }

        if (!validateRequiredId(id, res, `${this.options.entityName || 'Item'} ID`)) {
            return;
        }

        const item = await this.service.update(id!, req.body as UpdateData);

        if (!item) {
            sendError(res, `${this.options.entityName || 'Item'} not found`, 404);
            return;
        }

        sendSuccess(res, item, `${this.options.entityName || 'Item'} updated successfully`);
    });

    delete = withErrorHandling(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { id } = req.params;

        if (!this.validateAccess(req, res)) {
            return;
        }

        if (!validateRequiredId(id, res, `${this.options.entityName || 'Item'} ID`)) {
            return;
        }

        await this.service.delete(id!);
        sendSuccess(res, undefined, `${this.options.entityName || 'Item'} deleted successfully`);
    });
} 