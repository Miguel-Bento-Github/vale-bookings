/**
 * Centralized error message constants
 * Single source of truth for all error messages across the application
 */
export const ERROR_MESSAGES = {
  // Not found errors
  USER_NOT_FOUND: 'User not found',
  LOCATION_NOT_FOUND: 'Location not found',
  BOOKING_NOT_FOUND: 'Booking not found',
  SCHEDULE_NOT_FOUND: 'Schedule not found',
  VALET_NOT_FOUND: 'Valet not found',
  DOCUMENT_NOT_FOUND: 'Document not found',
  ROUTE_NOT_FOUND: 'Route not found',

  // Required field errors
  USER_ID_REQUIRED: 'User ID is required',
  LOCATION_ID_REQUIRED: 'Location ID is required',
  BOOKING_ID_REQUIRED: 'Booking ID is required',
  SCHEDULE_ID_REQUIRED: 'Schedule ID is required',
  VALET_ID_REQUIRED: 'Valet ID is required',
  EMAIL_REQUIRED: 'Email is required',
  PASSWORD_REQUIRED: 'Password is required',
  PROFILE_NAME_REQUIRED: 'Profile name is required',
  PROFILE_DATA_REQUIRED: 'Profile data is required',
  SEARCH_QUERY_REQUIRED: 'Search query is required',
  DATE_PARAMETER_REQUIRED: 'Date parameter is required',
  REFRESH_TOKEN_REQUIRED: 'Refresh token is required',

  // Format errors
  INVALID_EMAIL_FORMAT: 'Invalid email format',
  INVALID_DATE_FORMAT: 'Invalid date format',
  INVALID_TIME_FORMAT: 'Invalid time format',
  INVALID_ID_FORMAT: 'Invalid ID format',
  INVALID_COORDINATES_FORMAT: 'Invalid coordinates format',
  INVALID_PHONE_FORMAT: 'Invalid phone number format',

  // Already exists errors
  EMAIL_ALREADY_EXISTS: 'Email already exists',
  USER_ALREADY_EXISTS: 'User with this email already exists',
  LOCATION_ALREADY_EXISTS: 'Location already exists',
  SCHEDULE_ALREADY_EXISTS: 'Schedule already exists for this location and day',

  // Authentication/authorization errors
  USER_AUTH_REQUIRED: 'User authentication required',
  FORBIDDEN_ACCESS_DENIED: 'Forbidden: access denied',

  // Other common errors
  INVALID_JSON_PAYLOAD: 'Invalid JSON payload'
} as const; 