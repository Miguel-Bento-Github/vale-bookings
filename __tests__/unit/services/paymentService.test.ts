import * as PaymentService from '../../../src/services/paymentService';

describe('Payment Service', () => {
  describe('calculatePrice', () => {
    it('should calculate basic price for 2 hours', () => {
      const bookingData = {
        startTime: new Date('2024-12-01T10:00:00Z'),
        endTime: new Date('2024-12-01T12:00:00Z')
      };
      
      const location = {
        baseRate: 10
      };

      const result = PaymentService.calculatePrice(bookingData, location);

      expect(result.totalAmount).toBe(20); // 2 hours * 10 rate
    });

    it('should calculate price for 30 minutes as 1 hour minimum', () => {
      const bookingData = {
        startTime: new Date('2024-12-01T10:00:00Z'),
        endTime: new Date('2024-12-01T10:30:00Z')
      };
      
      const location = {
        baseRate: 15
      };

      const result = PaymentService.calculatePrice(bookingData, location);

      expect(result.totalAmount).toBe(8); // 0.5 hours * 15 rate = 7.5, rounded to 8
    });

    it('should calculate price for 3.5 hours', () => {
      const bookingData = {
        startTime: new Date('2024-12-01T09:00:00Z'),
        endTime: new Date('2024-12-01T12:30:00Z')
      };
      
      const location = {
        baseRate: 12
      };

      const result = PaymentService.calculatePrice(bookingData, location);

      expect(result.totalAmount).toBe(42); // 3.5 hours * 12 rate
    });
  });

  describe('calculateDynamicPrice', () => {
    it('should apply peak hour multiplier during business hours', () => {
      const bookingData = {
        locationId: 'loc-1',
        startTime: new Date('2024-12-01T14:00:00Z'), // 2 PM UTC = Sunday + peak hour
        endTime: new Date('2024-12-01T16:00:00Z')
      };
      
      const location = {
        baseRate: 10,
        isPremium: false
      };

      const result = PaymentService.calculateDynamicPrice(bookingData, location);

      expect(result.baseAmount).toBe(20); // 2 hours * 10 rate
      expect(result.timeMultiplier).toBe(1.2); // Peak hour multiplier
      expect(result.dayMultiplier).toBe(1.15); // Sunday = weekend
      expect(result.totalAmount).toBe(28); // 20 * 1.2 * 1.15 = 27.6 → 28
    });

    it('should apply weekend multiplier on Saturday', () => {
      const bookingData = {
        locationId: 'loc-1',
        startTime: new Date('2024-11-30T10:00:00Z'), // Saturday, 10 AM UTC = 11 AM = peak
        endTime: new Date('2024-11-30T12:00:00Z')
      };
      
      const location = {
        baseRate: 10,
        isPremium: false
      };

      const result = PaymentService.calculateDynamicPrice(bookingData, location);

      expect(result.timeMultiplier).toBe(1.2); // Peak hour (11 AM)
      expect(result.dayMultiplier).toBe(1.15); // Weekend multiplier
      expect(result.totalAmount).toBe(28); // 20 * 1.2 * 1.15 = 27.6 → 28
    });

    it('should apply premium location multiplier', () => {
      const bookingData = {
        locationId: 'loc-1',
        startTime: new Date('2024-12-01T10:00:00Z'), // Sunday, 10 AM UTC = 11 AM = peak
        endTime: new Date('2024-12-01T12:00:00Z')
      };
      
      const location = {
        baseRate: 10,
        isPremium: true
      };

      const result = PaymentService.calculateDynamicPrice(bookingData, location);

      expect(result.timeMultiplier).toBe(1.2); // Peak hour (11 AM)
      expect(result.dayMultiplier).toBe(1.15); // Sunday = weekend
      expect(result.premiumMultiplier).toBe(1.3); // Premium multiplier
      expect(result.totalAmount).toBe(36); // 20 * 1.2 * 1.15 * 1.3 = 35.88 → 36
    });

    it('should apply no multipliers for off-peak weekday', () => {
      const bookingData = {
        locationId: 'loc-1',
        startTime: new Date('2024-12-02T07:00:00Z'), // Monday, 7 AM UTC = 8 AM = off-peak
        endTime: new Date('2024-12-02T09:00:00Z')
      };
      
      const location = {
        baseRate: 10,
        isPremium: false
      };

      const result = PaymentService.calculateDynamicPrice(bookingData, location);

      expect(result.timeMultiplier).toBe(1.0); // Off-peak
      expect(result.dayMultiplier).toBe(1.0); // Weekday
      expect(result.premiumMultiplier).toBe(1.0); // Not premium
      expect(result.totalAmount).toBe(20); // 20 * 1.0 * 1.0 * 1.0
    });
  });
}); 