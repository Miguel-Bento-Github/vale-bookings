import { Response } from 'express';

import { AppError } from '../types';

export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface SuccessResponse<T = unknown> {
    success: true;
    data: T;
    message?: string;
    pagination?: PaginationMeta;
}

export interface ErrorResponse {
    success: false;
    message: string;
    error?: string;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): Response {
  const response: SuccessResponse<T> = {
    success: true,
    data
  };

  if (message !== undefined && message.trim().length > 0) {
    response.message = message;
  }

  return res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  message: string,
  statusCode: number = 500,
  error?: string
): Response {
  const response: ErrorResponse = {
    success: false,
    message
  };

  if (error !== undefined && error.trim().length > 0) {
    response.error = error;
  }

  return res.status(statusCode).json(response);
}

export function sendSuccessWithPagination<T>(
  res: Response,
  data: T,
  pagination: PaginationMeta,
  message?: string
): Response {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    pagination
  };

  if (message !== undefined && message.trim().length > 0) {
    response.message = message;
  }

  return res.status(200).json(response);
}

export function handleControllerError(error: unknown, res: Response): void {
  if (error instanceof AppError) {
    sendError(res, error.message, error.statusCode);
    return;
  }

  if (error instanceof Error) {
    console.error('Unexpected error:', error);
    sendError(res, 'Internal server error', 500);
    return;
  }

  console.error('Unknown error:', error);
  sendError(res, 'Internal server error', 500);
}

// Higher-order function to wrap controller functions with error handling
export function withErrorHandling<T extends unknown[]>(
  fn: (...args: T) => Promise<Response | void>
) {
  return async (...args: T): Promise<void> => {
    try {
      await fn(...args);
    } catch (error: unknown) {
      const res = args[1] as Response;
      handleControllerError(error, res);
    }
  };
} 