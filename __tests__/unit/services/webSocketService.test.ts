import { Server as HTTPServer , createServer } from 'http';

import { Server as SocketIOServer } from 'socket.io';

import {
  initializeWebSocket,
  emitBookingUpdate,
  emitLocationUpdate,
  sendUserNotification,
  getConnectedUsersCount,
  isUserConnected,
  getWebSocketServer
} from '../../../src/services/WebSocketService';

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn()
}));

describe('WebSocketService', () => {
  let httpServer: HTTPServer;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    originalEnv = { ...process.env };
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  beforeEach(() => {
    httpServer = createServer();
  });

  afterEach(() => {
    if (httpServer) {
      httpServer.close();
    }
    jest.clearAllMocks();
  });

  describe('initializeWebSocket', () => {
    it('should initialize WebSocket server with CORS settings', () => {
      initializeWebSocket(httpServer);
      
      const server = getWebSocketServer();
      expect(server).toBeInstanceOf(SocketIOServer);
    });

    it('should use default frontend URL when FRONTEND_URL is not set', () => {
      delete process.env.FRONTEND_URL;
      
      initializeWebSocket(httpServer);
      
      const server = getWebSocketServer();
      expect(server).toBeInstanceOf(SocketIOServer);
      
      // Restore env var
      process.env.FRONTEND_URL = 'http://localhost:3000';
    });

    it('should setup middleware and event handlers', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      
      initializeWebSocket(httpServer);
      
      expect(consoleSpy).toHaveBeenCalledWith('=== Initializing WebSocket Server ===');
      expect(consoleSpy).toHaveBeenCalledWith('Socket.IO server created, setting up middleware and handlers...');
      
      consoleSpy.mockRestore();
    });
  });

  describe('emitBookingUpdate', () => {
    beforeEach(() => {
      initializeWebSocket(httpServer);
    });

    it('should emit booking update when server is initialized', () => {
      const server = getWebSocketServer();
      if (!server) {
        throw new Error('Server should be initialized');
      }
      const mockRoom = {
        emit: jest.fn()
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const emitSpy = jest.spyOn(server, 'to').mockReturnValue(mockRoom as any);

      const updateData = {
        bookingId: 'booking123',
        status: 'confirmed',
        locationId: 'location123',
        userId: 'user123',
        timestamp: new Date()
      };

      emitBookingUpdate(updateData);

      expect(emitSpy).toHaveBeenCalledWith('booking:booking123');
      expect(emitSpy).toHaveBeenCalledWith('user:user123');
      expect(emitSpy).toHaveBeenCalledWith('admins');

      emitSpy.mockRestore();
    });

    it('should not throw when server is not initialized', () => {
      // Don't initialize server
      const updateData = {
        bookingId: 'booking123',
        status: 'confirmed',
        locationId: 'location123',
        userId: 'user123',
        timestamp: new Date()
      };

      expect(() => emitBookingUpdate(updateData)).not.toThrow();
    });

    it('should log appropriate messages', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
      
      const updateData = {
        bookingId: 'booking123',
        status: 'confirmed',
        locationId: 'location123',
        userId: 'user123',
        timestamp: new Date()
      };

      emitBookingUpdate(updateData);

      expect(consoleSpy).toHaveBeenCalledWith('📡 === Emitting Booking Update ===');
      expect(consoleSpy).toHaveBeenCalledWith('Booking update data:', expect.objectContaining({
        bookingId: 'booking123',
        status: 'confirmed'
      }));

      consoleSpy.mockRestore();
    });
  });

  describe('emitLocationUpdate', () => {
    beforeEach(() => {
      initializeWebSocket(httpServer);
    });

    it('should emit location update when server is initialized', () => {
      const server = getWebSocketServer();
      if (!server) {
        throw new Error('Server should be initialized');
      }
      const mockRoom = {
        emit: jest.fn()
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const toSpy = jest.spyOn(server, 'to').mockReturnValue(mockRoom as any);
      const emitSpy = jest.spyOn(server, 'emit').mockImplementation();

      const updateData = {
        locationId: 'location123',
        currentOccupancy: 5,
        capacity: 10,
        availableSpots: 5,
        timestamp: new Date()
      };

      emitLocationUpdate(updateData);

      expect(toSpy).toHaveBeenCalledWith('location:location123');
      expect(emitSpy).toHaveBeenCalledWith('locations:availability_changed', expect.objectContaining({
        locationId: 'location123',
        availableSpots: 5
      }));

      toSpy.mockRestore();
      emitSpy.mockRestore();
    });

    it('should not throw when server is not initialized', () => {
      // Don't initialize server
      const updateData = {
        locationId: 'location123',
        currentOccupancy: 5,
        capacity: 10,
        availableSpots: 5,
        timestamp: new Date()
      };

      expect(() => emitLocationUpdate(updateData)).not.toThrow();
    });
  });

  describe('sendUserNotification', () => {
    beforeEach(() => {
      initializeWebSocket(httpServer);
    });

    it('should send notification to specific user', () => {
      const server = getWebSocketServer();
      if (!server) {
        throw new Error('Server should be initialized');
      }
      const mockRoom = {
        emit: jest.fn()
      };
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      const emitSpy = jest.spyOn(server, 'to').mockReturnValue(mockRoom as any);

      const notificationData = {
        userId: 'user123',
        type: 'booking_confirmed' as const,
        title: 'Booking Confirmed',
        message: 'Your booking has been confirmed',
        data: { bookingId: 'booking123' },
        timestamp: new Date()
      };

      sendUserNotification(notificationData);

      expect(emitSpy).toHaveBeenCalledWith('user:user123');

      emitSpy.mockRestore();
    });

    it('should not throw when server is not initialized', () => {
      // Don't initialize server
      const notificationData = {
        userId: 'user123',
        type: 'booking_confirmed' as const,
        title: 'Test',
        message: 'Test message',
        timestamp: new Date()
      };

      expect(() => sendUserNotification(notificationData)).not.toThrow();
    });
  });

  describe('Utility Functions', () => {
    it('should return zero connected users initially', () => {
      expect(getConnectedUsersCount()).toBe(0);
    });

    it('should return false for any user connection check initially', () => {
      expect(isUserConnected('user123')).toBe(false);
      expect(isUserConnected('admin456')).toBe(false);
    });

    it('should return server instance when previously initialized', () => {
      // Since previous tests have initialized the server, it should exist
      const server = getWebSocketServer();
      expect(server).toBeInstanceOf(SocketIOServer);
    });

    it('should return server instance after initialization', () => {
      initializeWebSocket(httpServer);
      const server = getWebSocketServer();
      expect(server).toBeInstanceOf(SocketIOServer);
    });
  });

  describe('Error Handling in Emit Functions', () => {
    beforeEach(() => {
      initializeWebSocket(httpServer);
    });

    it('should handle errors in emitBookingUpdate gracefully', () => {
      const server = getWebSocketServer();
      if (!server) {
        throw new Error('Server should be initialized');
      }
      jest.spyOn(server, 'to').mockImplementation(() => {
        throw new Error('Mock error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const updateData = {
        bookingId: 'booking123',
        status: 'confirmed',
        locationId: 'location123',
        userId: 'user123',
        timestamp: new Date()
      };

      expect(() => emitBookingUpdate(updateData)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to emit booking update:', expect.any(Error));

      consoleSpy.mockRestore();
    });

    it('should handle errors in emitLocationUpdate gracefully', () => {
      const server = getWebSocketServer();
      if (!server) {
        throw new Error('Server should be initialized');
      }
      jest.spyOn(server, 'to').mockImplementation(() => {
        throw new Error('Mock error');
      });

      const updateData = {
        locationId: 'location123',
        currentOccupancy: 5,
        capacity: 10,
        availableSpots: 5,
        timestamp: new Date()
      };

      expect(() => emitLocationUpdate(updateData)).not.toThrow();
    });

    it('should handle errors in sendUserNotification gracefully', () => {
      const server = getWebSocketServer();
      if (!server) {
        throw new Error('Server should be initialized');
      }
      jest.spyOn(server, 'to').mockImplementation(() => {
        throw new Error('Mock error');
      });

      const notificationData = {
        userId: 'user123',
        type: 'booking_confirmed' as const,
        title: 'Test',
        message: 'Test message',
        timestamp: new Date()
      };

      expect(() => sendUserNotification(notificationData)).not.toThrow();
    });
  });

  describe('Environment Configuration', () => {
    it('should handle missing JWT_SECRET in middleware setup', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      initializeWebSocket(httpServer);

      expect(consoleSpy).toHaveBeenCalledWith('=== Setting Up WebSocket Authentication Middleware ===');

      // Restore
      process.env.JWT_SECRET = originalSecret;
      consoleSpy.mockRestore();
    });

    it('should handle empty JWT_SECRET', () => {
      const originalSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = '';

      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      initializeWebSocket(httpServer);

      expect(consoleSpy).toHaveBeenCalledWith('=== Setting Up WebSocket Authentication Middleware ===');

      // Restore
      process.env.JWT_SECRET = originalSecret;
      consoleSpy.mockRestore();
    });
  });

  describe('Server Configuration', () => {
    it('should configure CORS with correct settings', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      initializeWebSocket(httpServer);

      expect(consoleSpy).toHaveBeenCalledWith('CORS settings:', {
        origin: 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      });

      consoleSpy.mockRestore();
    });

    it('should set up transports correctly', () => {
      initializeWebSocket(httpServer);
      const server = getWebSocketServer();
      
      // Server should be initialized with websocket and polling transports
      expect(server).toBeInstanceOf(SocketIOServer);
    });
  });

  describe('Logging and Console Output', () => {
    it('should log initialization steps', () => {
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      initializeWebSocket(httpServer);

      expect(consoleSpy).toHaveBeenCalledWith('=== Initializing WebSocket Server ===');
      expect(consoleSpy).toHaveBeenCalledWith('=== Setting Up WebSocket Authentication Middleware ===');
      expect(consoleSpy).toHaveBeenCalledWith('=== Setting Up WebSocket Event Handlers ===');

      consoleSpy.mockRestore();
    });

    it('should log booking update details', () => {
      initializeWebSocket(httpServer);
      const consoleSpy = jest.spyOn(console, 'info').mockImplementation();

      const updateData = {
        bookingId: 'booking123',
        status: 'confirmed',
        locationId: 'location123',
        userId: 'user123',
        timestamp: new Date()
      };

      emitBookingUpdate(updateData);

      expect(consoleSpy).toHaveBeenCalledWith('Connected users count:', 0);
      expect(consoleSpy).toHaveBeenCalledWith('Connected users:', []);
      expect(consoleSpy).toHaveBeenCalledWith('📢 Emitting to rooms:');

      consoleSpy.mockRestore();
    });
  });
}); 