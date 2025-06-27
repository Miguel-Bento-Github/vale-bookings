import { createServer } from 'http';

import * as WebSocketService from '../../../src/services/WebSocketService';
import { logInfo } from '../../../src/utils/logger';

// Mock dependencies
jest.mock('../../../src/utils/logger');

const mockLogInfo = logInfo as jest.MockedFunction<typeof logInfo>;

describe('WebSocketService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getWebSocketServer', () => {
    it('should return null when server not initialized', () => {
      const server = WebSocketService.getWebSocketServer();
      expect(server).toBeNull();
    });
  });

  describe('getConnectedUsersCount', () => {
    it('should return 0 when no users connected', () => {
      const count = WebSocketService.getConnectedUsersCount();
      expect(count).toBe(0);
    });
  });

  describe('isUserConnected', () => {
    it('should return false when user not connected', () => {
      const isConnected = WebSocketService.isUserConnected('user-123');
      expect(isConnected).toBe(false);
    });

    it('should return false for empty user ID', () => {
      const isConnected = WebSocketService.isUserConnected('');
      expect(isConnected).toBe(false);
    });

    it('should return false for whitespace user ID', () => {
      const isConnected = WebSocketService.isUserConnected('   ');
      expect(isConnected).toBe(false);
    });
  });

  describe('emitBookingUpdate', () => {
    const bookingUpdateData = {
      bookingId: 'booking-123',
      status: 'CONFIRMED',
      locationId: 'location-456',
      userId: 'user-789',
      timestamp: new Date()
    };

    it('should handle when WebSocket server not initialized without throwing', () => {
      expect(() => {
        WebSocketService.emitBookingUpdate(bookingUpdateData);
      }).not.toThrow();
    });

    it('should handle different booking statuses without throwing', () => {
      const statuses = ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
      
      statuses.forEach(status => {
        expect(() => {
          WebSocketService.emitBookingUpdate({
            ...bookingUpdateData,
            status
          });
        }).not.toThrow();
      });
    });

    it('should handle empty booking data gracefully', () => {
      expect(() => {
        WebSocketService.emitBookingUpdate({
          bookingId: '',
          status: '',
          locationId: '',
          userId: '',
          timestamp: new Date()
        });
      }).not.toThrow();
    });

    it('should handle long booking IDs gracefully', () => {
      expect(() => {
        WebSocketService.emitBookingUpdate({
          ...bookingUpdateData,
          bookingId: 'a'.repeat(1000)
        });
      }).not.toThrow();
    });

    it('should handle special characters in booking data', () => {
      expect(() => {
        WebSocketService.emitBookingUpdate({
          bookingId: 'booking-123!@#$%^&*()',
          status: 'CONFIRMED',
          locationId: 'location-456<script>',
          userId: 'user-789"\'',
          timestamp: new Date()
        });
      }).not.toThrow();
    });
  });

  describe('emitLocationUpdate', () => {
    const locationUpdateData = {
      locationId: 'location-123',
      currentOccupancy: 5,
      capacity: 10,
      availableSpots: 5,
      timestamp: new Date()
    };

    it('should handle when WebSocket server not initialized without throwing', () => {
      expect(() => {
        WebSocketService.emitLocationUpdate(locationUpdateData);
      }).not.toThrow();
    });

    it('should handle zero availability gracefully', () => {
      expect(() => {
        WebSocketService.emitLocationUpdate({
          locationId: 'location-full',
          currentOccupancy: 10,
          capacity: 10,
          availableSpots: 0,
          timestamp: new Date()
        });
      }).not.toThrow();
    });

    it('should handle full availability gracefully', () => {
      expect(() => {
        WebSocketService.emitLocationUpdate({
          locationId: 'location-empty',
          currentOccupancy: 0,
          capacity: 20,
          availableSpots: 20,
          timestamp: new Date()
        });
      }).not.toThrow();
    });

    it('should handle negative values gracefully', () => {
      expect(() => {
        WebSocketService.emitLocationUpdate({
          locationId: 'location-negative',
          currentOccupancy: -1,
          capacity: -1,
          availableSpots: -1,
          timestamp: new Date()
        });
      }).not.toThrow();
    });

    it('should handle very large numbers gracefully', () => {
      expect(() => {
        WebSocketService.emitLocationUpdate({
          locationId: 'location-large',
          currentOccupancy: Number.MAX_SAFE_INTEGER,
          capacity: Number.MAX_SAFE_INTEGER,
          availableSpots: Number.MAX_SAFE_INTEGER,
          timestamp: new Date()
        });
      }).not.toThrow();
    });

    it('should handle empty location ID gracefully', () => {
      expect(() => {
        WebSocketService.emitLocationUpdate({
          locationId: '',
          currentOccupancy: 5,
          capacity: 10,
          availableSpots: 5,
          timestamp: new Date()
        });
      }).not.toThrow();
    });
  });

  describe('sendUserNotification', () => {
    const notificationData = {
      userId: 'user-123',
      type: 'booking_confirmed' as const,
      title: 'Booking Confirmed',
      message: 'Your booking has been confirmed',
      data: { bookingId: 'booking-456' },
      timestamp: new Date()
    };

    it('should handle when WebSocket server not initialized without throwing', () => {
      expect(() => {
        WebSocketService.sendUserNotification(notificationData);
      }).not.toThrow();
    });

    it('should handle all notification types without throwing', () => {
      const notificationTypes = [
        'booking_confirmed',
        'booking_cancelled', 
        'booking_completed',
        'location_available'
      ] as const;

      notificationTypes.forEach(type => {
        expect(() => {
          WebSocketService.sendUserNotification({
            userId: 'user-123',
            type,
            title: `Test ${type}`,
            message: `Test message for ${type}`,
            timestamp: new Date()
          });
        }).not.toThrow();
      });
    });

    it('should handle notification without additional data', () => {
      expect(() => {
        WebSocketService.sendUserNotification({
          userId: 'user-123',
          type: 'booking_cancelled',
          title: 'Booking Cancelled',
          message: 'Your booking has been cancelled',
          timestamp: new Date()
        });
      }).not.toThrow();
    });

    it('should handle empty user ID gracefully', () => {
      expect(() => {
        WebSocketService.sendUserNotification({
          ...notificationData,
          userId: ''
        });
      }).not.toThrow();
    });

    it('should handle empty title and message gracefully', () => {
      expect(() => {
        WebSocketService.sendUserNotification({
          ...notificationData,
          title: '',
          message: ''
        });
      }).not.toThrow();
    });

    it('should handle very long messages gracefully', () => {
      expect(() => {
        WebSocketService.sendUserNotification({
          ...notificationData,
          title: 'A'.repeat(1000),
          message: 'B'.repeat(10000)
        });
      }).not.toThrow();
    });

    it('should handle special characters in notification data', () => {
      expect(() => {
        WebSocketService.sendUserNotification({
          ...notificationData,
          title: 'Title with <script>alert("xss")</script>',
          message: 'Message with "quotes" and \'apostrophes\' and & symbols'
        });
      }).not.toThrow();
    });

    it('should handle complex nested data objects', () => {
      expect(() => {
        WebSocketService.sendUserNotification({
          ...notificationData,
          data: {
            bookingId: 'booking-456',
            nested: {
              level1: {
                level2: {
                  value: 'deep nesting'
                }
              }
            },
            array: [1, 2, 3, { key: 'value' }],
            nullValue: null,
            undefinedValue: undefined,
            booleanValue: true,
            numberValue: 42.5
          }
        });
      }).not.toThrow();
    });
  });

  describe('initializeWebSocket', () => {
    it('should initialize without throwing with valid HTTP server', () => {
      const mockHttpServer = createServer();
      
      expect(() => {
        WebSocketService.initializeWebSocket(mockHttpServer);
      }).not.toThrow();
      
      mockHttpServer.close();
    });

    it('should log initialization success', () => {
      const mockHttpServer = createServer();
      
      WebSocketService.initializeWebSocket(mockHttpServer);
      
      expect(mockLogInfo).toHaveBeenCalledWith('✅ WebSocket service initialized successfully');
      
      mockHttpServer.close();
    });

    it('should handle environment variables correctly', () => {
      const originalFrontendUrl = process.env.FRONTEND_URL;
      
      // Test with custom frontend URL
      process.env.FRONTEND_URL = 'https://custom-frontend.com';
      
      const mockHttpServer = createServer();
      
      expect(() => {
        WebSocketService.initializeWebSocket(mockHttpServer);
      }).not.toThrow();
      
      mockHttpServer.close();
      
      // Restore original environment
      if (originalFrontendUrl !== undefined) {
        process.env.FRONTEND_URL = originalFrontendUrl;
      } else {
        delete process.env.FRONTEND_URL;
      }
    });

    it('should handle missing environment variables gracefully', () => {
      const originalFrontendUrl = process.env.FRONTEND_URL;
      
      // Remove frontend URL to test default
      delete process.env.FRONTEND_URL;
      
      const mockHttpServer = createServer();
      
      expect(() => {
        WebSocketService.initializeWebSocket(mockHttpServer);
      }).not.toThrow();
      
      mockHttpServer.close();
      
      // Restore original environment
      if (originalFrontendUrl !== undefined) {
        process.env.FRONTEND_URL = originalFrontendUrl;
      }
    });
  });

  describe('Edge cases and boundary conditions', () => {
    it('should handle Date objects at different times', () => {
      const dates = [
        new Date(0), // Unix epoch
        new Date('1970-01-01'), // Beginning of time
        new Date('2038-01-19'), // Y2K38 problem
        new Date('2099-12-31'), // Far future
        new Date() // Current time
      ];

      dates.forEach(date => {
        expect(() => {
          WebSocketService.emitBookingUpdate({
            bookingId: 'test',
            status: 'CONFIRMED',
            locationId: 'test',
            userId: 'test',
            timestamp: date
          });
        }).not.toThrow();

        expect(() => {
          WebSocketService.emitLocationUpdate({
            locationId: 'test',
            currentOccupancy: 1,
            capacity: 10,
            availableSpots: 9,
            timestamp: date
          });
        }).not.toThrow();

        expect(() => {
          WebSocketService.sendUserNotification({
            userId: 'test',
            type: 'booking_confirmed',
            title: 'Test',
            message: 'Test',
            timestamp: date
          });
        }).not.toThrow();
      });
    });

    it('should handle concurrent function calls', () => {
      const promises = [];
      
      // Simulate concurrent calls
      for (let i = 0; i < 10; i++) {
        promises.push(
          Promise.resolve().then(() => {
            WebSocketService.emitBookingUpdate({
              bookingId: `booking-${i}`,
              status: 'CONFIRMED',
              locationId: `location-${i}`,
              userId: `user-${i}`,
              timestamp: new Date()
            });
          })
        );
        
        promises.push(
          Promise.resolve().then(() => {
            WebSocketService.emitLocationUpdate({
              locationId: `location-${i}`,
              currentOccupancy: i,
              capacity: 10,
              availableSpots: 10 - i,
              timestamp: new Date()
            });
          })
        );
        
        promises.push(
          Promise.resolve().then(() => {
            WebSocketService.sendUserNotification({
              userId: `user-${i}`,
              type: 'booking_confirmed',
              title: `Notification ${i}`,
              message: `Message ${i}`,
              timestamp: new Date()
            });
          })
        );
      }

      return Promise.all(promises).then(() => {
        // All calls should complete without throwing
        expect(true).toBe(true);
      });
    });

    it('should handle rapid successive calls', () => {
      expect(() => {
        for (let i = 0; i < 100; i++) {
          WebSocketService.emitBookingUpdate({
            bookingId: `rapid-${i}`,
            status: 'CONFIRMED',
            locationId: 'location',
            userId: 'user',
            timestamp: new Date()
          });
        }
      }).not.toThrow();
    });
  });
}); 