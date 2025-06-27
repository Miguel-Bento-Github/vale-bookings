/**
 * Types barrel export - organized by domain
 * Clean imports for domain-specific types
 */

// Common types (shared across domains)
export * from './common';

// Domain-specific types
export * from './user';
export * from './location';
export * from './booking';
export * from './schedule';
export * from './payment';

// Export all widget types
export * from './widget'; 