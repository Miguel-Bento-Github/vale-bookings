/**
 * Validation constants
 * Centralized validation rules and allowed values
 */

// User roles
export const USER_ROLES = ['CUSTOMER', 'VALET', 'ADMIN'] as const;
export type UserRole = typeof USER_ROLES[number];

// Booking statuses
export const BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export type BookingStatus = typeof BOOKING_STATUSES[number];

// Days of the week
export const DAYS_OF_WEEK = [
  'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'
] as const;
export type DayOfWeek = typeof DAYS_OF_WEEK[number];

// Pagination defaults
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 10,
  MAX_LIMIT: 100
} as const;

// Coordinate validation ranges
export const COORDINATE_RANGES = {
  LATITUDE: { MIN: -90, MAX: 90 },
  LONGITUDE: { MIN: -180, MAX: 180 }
} as const;

// Password validation
export const PASSWORD_CONSTRAINTS = {
  MIN_LENGTH: 6,
  MAX_LENGTH: 128
} as const;

// Email validation
export const EMAIL_CONSTRAINTS = {
  MAX_LENGTH: 64,
  REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
} as const; 