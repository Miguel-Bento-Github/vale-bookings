import { Model, Document } from 'mongoose';

import { AppError } from '../types';

import { ERROR_MESSAGES } from './validationHelpers';

/**
 * Handles MongoDB duplicate key errors (code 11000) and throws appropriate AppError
 */
export function handleDuplicateKeyError(error: unknown, defaultMessage: string): never {
  if (error instanceof Error && 'code' in error && error.code === 11000) {
    throw new AppError(defaultMessage, 409);
  }
  throw error;
}

/**
 * Creates a document with automatic duplicate key error handling
 */
export async function createWithDuplicateHandling<T extends Document>(
  ModelClass: Model<T>,
  data: Partial<T>,
  duplicateMessage: string
): Promise<T> {
  try {
    const document = new ModelClass(data);
    return await document.save();
  } catch (error: unknown) {
    handleDuplicateKeyError(error, duplicateMessage);
  }
}

/**
 * Generic update operation with standard options
 */
export async function standardUpdate<T extends Document>(
  ModelClass: Model<T>,
  id: string,
  updateData: Partial<T>,
  options: { new?: boolean; runValidators?: boolean } = {}
): Promise<T | null> {
  const defaultOptions = { new: true, runValidators: true, ...options };
  return await ModelClass.findByIdAndUpdate(
    id,
    { $set: updateData },
    defaultOptions
  );
}

/**
 * Generic update operation with custom update object (for complex updates)
 */
export async function customUpdate<T extends Document>(
  ModelClass: Model<T>,
  id: string,
  updateObject: Record<string, unknown>,
  options: { new?: boolean; runValidators?: boolean } = {}
): Promise<T | null> {
  const defaultOptions = { new: true, runValidators: true, ...options };
  return await ModelClass.findByIdAndUpdate(id, updateObject, defaultOptions);
}

/**
 * Standard deactivation pattern
 */
export async function deactivateDocument<T extends Document>(
  ModelClass: Model<T>,
  id: string
): Promise<T | null> {
  return await standardUpdate(ModelClass, id, { isActive: false } as unknown as Partial<T>);
}

/**
 * Standard activation pattern
 */
export async function activateDocument<T extends Document>(
  ModelClass: Model<T>,
  id: string
): Promise<T | null> {
  return await standardUpdate(ModelClass, id, { isActive: true } as unknown as Partial<T>);
}

/**
 * Ensures document exists before proceeding
 */
export async function ensureDocumentExists<T extends Document>(
  ModelClass: Model<T>,
  id: string,
  errorMessage: string = ERROR_MESSAGES.DOCUMENT_NOT_FOUND
): Promise<T> {
  const document = await ModelClass.findById(id);
  if (!document) {
    throw new AppError(errorMessage, 404);
  }
  return document;
}

/**
 * Safe document count with error handling
 */
export async function safeCountDocuments<T extends Document>(
  ModelClass: Model<T>,
  filter: Record<string, unknown> = {}
): Promise<number> {
  try {
    return await ModelClass.countDocuments(filter);
  } catch (error) {
    console.error('Error counting documents:', error);
    return 0;
  }
}

/**
 * Generic existence check helper
 */
export async function checkDocumentExists<T extends Document>(
  ModelClass: Model<T>,
  filter: Record<string, unknown>,
  errorMessage: string
): Promise<void> {
  const existing = await ModelClass.findOne(filter);
  if (existing) {
    throw new AppError(errorMessage, 409);
  }
}

/**
 * Simple find with pagination (without complex populate typing)
 */
export async function findWithPagination<T extends Document>(
  ModelClass: Model<T>,
  filter: Record<string, unknown> = {},
  page: number = 1,
  limit: number = 10,
  sort?: Record<string, 1 | -1>
): Promise<{ documents: T[]; totalCount: number; pagination: { page: number; limit: number; totalPages: number } }> {
  const validPage = Math.max(1, page);
  const validLimit = Math.min(100, Math.max(1, limit));
  const skip = (validPage - 1) * validLimit;

  const queryOptions = { skip, limit: validLimit };
  if (sort) {
    Object.assign(queryOptions, { sort });
  }

  const [documents, totalCount] = await Promise.all([
    ModelClass.find(filter, null, queryOptions).exec(),
    ModelClass.countDocuments(filter)
  ]);

  return {
    documents,
    totalCount,
    pagination: {
      page: validPage,
      limit: validLimit,
      totalPages: Math.ceil(totalCount / validLimit)
    }
  };
}

/**
 * Safe delete operation with existence check
 */
export async function safeDelete<T extends Document>(
  ModelClass: Model<T>,
  id: string,
  errorMessage: string = ERROR_MESSAGES.DOCUMENT_NOT_FOUND
): Promise<void> {
  const result = await ModelClass.findByIdAndDelete(id);
  if (!result) {
    throw new AppError(errorMessage, 404);
  }
}

/**
 * Common MongoDB update patterns
 */
export const UpdatePatterns = {
  deactivate: { isActive: false },
  activate: { isActive: true },
  setUpdatedTime: { updatedAt: new Date() }
} as const;

