import { AppError } from '../../../src/types';
import { handleDuplicateKeyError, UpdatePatterns } from '../../../src/utils/mongoHelpers';

describe('mongoHelpers', () => {
  describe('handleDuplicateKeyError', () => {
    it('should throw AppError with 409 status for duplicate key error', () => {
      const duplicateError = new Error('Duplicate key error');
      (duplicateError as { code?: number }).code = 11000;

      expect(() => {
        handleDuplicateKeyError(duplicateError, 'Duplicate entry');
      }).toThrow(AppError);

      try {
        handleDuplicateKeyError(duplicateError, 'Duplicate entry');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(409);
        expect((error as AppError).message).toBe('Duplicate entry');
      }
    });

    it('should re-throw non-duplicate key errors', () => {
      const regularError = new Error('Regular error');

      expect(() => {
        handleDuplicateKeyError(regularError, 'Duplicate entry');
      }).toThrow('Regular error');
    });

    it('should handle errors without code property', () => {
      const errorWithoutCode = new Error('Error without code');

      expect(() => {
        handleDuplicateKeyError(errorWithoutCode, 'Duplicate entry');
      }).toThrow('Error without code');
    });
  });

  describe('UpdatePatterns', () => {
    it('should have correct deactivate pattern', () => {
      expect(UpdatePatterns.deactivate).toEqual({ isActive: false });
    });

    it('should have correct activate pattern', () => {
      expect(UpdatePatterns.activate).toEqual({ isActive: true });
    });

    it('should have setUpdatedTime pattern', () => {
      expect(UpdatePatterns.setUpdatedTime).toHaveProperty('updatedAt');
      expect(UpdatePatterns.setUpdatedTime.updatedAt).toBeInstanceOf(Date);
    });
  });
}); 