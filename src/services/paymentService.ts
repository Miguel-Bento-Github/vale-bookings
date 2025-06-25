export interface BookingData {
  startTime: Date;
  endTime: Date;
}

export interface LocationData {
  baseRate: number;
}

export interface PriceResult {
  totalAmount: number;
}

export function calculatePrice(
  bookingData: BookingData,
  location: LocationData
): PriceResult {
  const durationMs = bookingData.endTime.getTime() - bookingData.startTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);
  const totalAmount = Math.round(durationHours * location.baseRate);
  
  return {
    totalAmount
  };
}

export interface DynamicBookingData {
  locationId: string;
  startTime: Date;
  endTime: Date;
}

export interface DynamicLocationData {
  baseRate: number;
  isPremium?: boolean;
}

export interface DynamicPriceResult {
  baseAmount: number;
  timeMultiplier: number;
  dayMultiplier: number;
  premiumMultiplier: number;
  demandMultiplier: number;
  totalAmount: number;
}

export function calculateDynamicPrice(
  bookingData: DynamicBookingData,
  location: DynamicLocationData
): DynamicPriceResult {
  const { startTime, endTime } = bookingData;
  const { baseRate, isPremium = false } = location;
  
  // Calculate duration in hours
  const durationMs = endTime.getTime() - startTime.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);
  const baseAmount = Math.round(durationHours * baseRate);
  
  // Time-based multiplier (peak hours: 9 AM - 6 PM)
  const hour = startTime.getHours();
  const timeMultiplier = (hour >= 9 && hour < 18) ? 1.2 : 1.0;
  
  // Day-based multiplier (weekends: Saturday = 6, Sunday = 0)
  const dayOfWeek = startTime.getDay();
  const dayMultiplier = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.15 : 1.0;
  
  // Premium location multiplier
  const premiumMultiplier = isPremium ? 1.3 : 1.0;
  
  // Demand multiplier (static for now)
  const demandMultiplier = 1.0;
  
  const totalAmount = Math.round(
    baseAmount * timeMultiplier * dayMultiplier * premiumMultiplier * demandMultiplier
  );
  
  return {
    baseAmount,
    timeMultiplier,
    dayMultiplier,
    premiumMultiplier,
    demandMultiplier,
    totalAmount
  };
}
