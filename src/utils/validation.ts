export const validateEmail = (email: string): boolean => {
  // RFC 5322 compliant email regex that requires a proper domain with TLD
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

  // Check if email matches regex and is within length limits
  // RFC 5321: total length <= 254 characters
  // Local part <= 64 characters
  // Domain part <= 255 characters
  if (!emailRegex.test(email)) return false;
  if (email.length > 254) return false;

  const parts = email.split('@');
  if (parts.length !== 2) return false;

  // We can safely assert non-null here because we checked parts.length === 2
  const localPart = parts[0]!;
  const domain = parts[1]!;

  if (localPart.length > 64) return false;
  if (domain.length > 255) return false;

  // Additional check: domain must contain at least one dot (TLD requirement)
  if (!domain.includes('.')) return false;

  return true;
};

export const validatePassword = (password: string): boolean => {
  return typeof password === 'string' && password.length >= 6;
};

export const validateCoordinates = (latitude: number, longitude: number): boolean => {
  return (
    latitude >= -90 && 
    latitude <= 90 && 
    longitude >= -180 && 
    longitude <= 180
  );
};

export const validateTimeFormat = (time: string): boolean => {
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timeRegex.test(time);
};

export const validatePhoneNumber = (phone: string): boolean => {
  const phoneRegex = /^\+?[\d\s\-()]{10,}$/;
  return phoneRegex.test(phone);
}; 