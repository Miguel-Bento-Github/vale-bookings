import { Response, Request } from 'express';

import { AppError } from '../types';

interface SuccessResponse<T = unknown> {
    success: true;
    data?: T;
    message?: string;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

interface ErrorResponse {
    success: false;
    message: string;
}

export function sendSuccess<T>(res: Response, data?: T, message?: string, statusCode: number = 200): void {
  const response: SuccessResponse<T> = { success: true };

  if (data !== undefined) {
    response.data = data;
  }

  if (message && message.length > 0) {
    response.message = message;
  }

  res.status(statusCode).json(response);
}

export function sendSuccessWithPagination<T>(
  res: Response,
  data: T,
  pagination: { page: number; limit: number; total: number; totalPages: number },
  statusCode: number = 200
): void {
  res.status(statusCode).json({
    success: true,
    data,
    pagination
  });
}

export function sendError(res: Response, message: string, statusCode: number = 400): void {
  const response: ErrorResponse = {
    success: false,
    message
  };

  res.status(statusCode).json(response);
}

export function handleControllerError(res: Response, error: unknown): void {
  if (error instanceof AppError) {
    sendError(res, error.message, error.statusCode);
  } else {
    sendError(res, 'Internal server error', 500);
  }
}

// Higher-order function to wrap controller functions with error handling
export function withErrorHandling(
  controllerFn: (req: Request, res: Response) => Promise<void>
) {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      await controllerFn(req, res);
    } catch (error) {
      handleControllerError(res, error);
    }
  };
} 