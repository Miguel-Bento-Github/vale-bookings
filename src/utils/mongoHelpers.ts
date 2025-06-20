import { Model, Document } from 'mongoose';

import { AppError } from '../types';

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
 * Standard update operation with common options
 */
export async function standardUpdate<T extends Document>(
  ModelClass: Model<T>,
  id: string,
  updateData: Record<string, unknown>,
  options: {
        new?: boolean;
        runValidators?: boolean;
        upsert?: boolean;
    } = { new: true, runValidators: true }
): Promise<T | null> {
  return await ModelClass.findByIdAndUpdate(
    id,
    { $set: updateData },
    options
  );
}

/**
 * Standard deactivation pattern
 */
export async function deactivateDocument<T extends Document>(
  ModelClass: Model<T>,
  id: string
): Promise<T | null> {
  return await standardUpdate(ModelClass, id, { isActive: false });
}

/**
 * Checks if a document exists, throws 404 if not found
 */
export async function ensureDocumentExists<T extends Document>(
  ModelClass: Model<T>,
  id: string,
  entityName: string
): Promise<T> {
  const document = await ModelClass.findById(id);
  if (!document) {
    throw new AppError(`${entityName} not found`, 404);
  }
  return document;
}

/**
 * Count documents matching condition with error handling
 */
export async function safeCountDocuments<T extends Document>(
  ModelClass: Model<T>,
  condition: Record<string, unknown>
): Promise<number> {
  try {
    return await ModelClass.countDocuments(condition);
  } catch {
    throw new AppError('Failed to count documents', 500);
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

