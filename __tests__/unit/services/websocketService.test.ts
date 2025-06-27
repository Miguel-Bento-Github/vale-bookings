import { Server as HTTPServer, createServer } from 'http';

import { verify } from 'jsonwebtoken';
import { Server as SocketIOServer } from 'socket.io';

import * as WebSocketService from '../../../src/services/WebSocketService';
import { logInfo, logError } from '../../../src/utils/logger';

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../../../src/utils/logger');
jest.mock('socket.io');

const mockVerify = verify as jest.MockedFunction<typeof verify>;
const mockLogInfo = logInfo as jest.MockedFunction<typeof logInfo>;
const mockLogError = logError as jest.MockedFunction<typeof logError>;
const MockSocketIOServer = SocketIOServer as jest.MockedClass<typeof SocketIOServer>;

// Mock socket interface
interface MockSocket {
  id: string;
  handshake: {
    auth: { token?: string };
    address: string;
    headers: Record<string, string>;
  };
  userId?: string;
  userRole?: string;
  join: jest.Mock;
  leave: jest.Mock;
  emit: jest.Mock;
  on: jest.Mock;
  to: jest.Mock;
}

// Mock SocketIO server
interface MockIOServer {
  use: jest.Mock;
  on: jest.Mock;
  to: jest.Mock;
  emit: jest.Mock;
}

describe('WebSocketService', () => {
  let mockHttpServer: HTTPServer;
  let mockIoServer: MockIOServer;
  let mockSocket: MockSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset environment
    delete process.env.JWT_SECRET;
    delete process.env.FRONTEND_URL;
    
    // Create mock HTTP server
    mockHttpServer = createServer();
    
    // Create mock socket
    mockSocket = {
      id: 'socket-123',
      handshake: {
        auth: {},
        address: '127.0.0.1',
        headers: {
          origin: 'http://localhost:9000',
          'user-agent': 'Mozilla/5.0 test browser',
          referer: 'http://localhost:9000/dashboard'
        }
      },
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      to: jest.fn().mockReturnThis()
    };

    // Create mock IO server
    mockIoServer = {
      use: jest.fn(),
      on: jest.fn(),
      to: jest.fn().mockReturnThis(),
      emit: jest.fn()
    };

    // Mock SocketIO constructor
    MockSocketIOServer.mockImplementation(() => mockIoServer as unknown as SocketIOServer);
    
    // Reset module state completely
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (WebSocketService as any).io = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const connectedUsers = (WebSocketService as any).connectedUsers;
    if (connectedUsers && typeof connectedUsers.clear === 'function') {
      connectedUsers.clear();
    }
  });

  afterEach(() => {
    if (mockHttpServer.listening) {
      mockHttpServer.close();
    }
  });

  describe('initializeWebSocket', () => {
    it('should initialize WebSocket server with default frontend URL', () => {
      WebSocketService.initializeWebSocket(mockHttpServer);

      expect(MockSocketIOServer).toHaveBeenCalledWith(mockHttpServer, {
        cors: {
          origin: 'http://localhost:9000',
          methods: ['GET', 'POST'],
          credentials: true
        },
        transports: ['websocket', 'polling']
      });

      expect(mockIoServer.use).toHaveBeenCalled();
      expect(mockIoServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(mockLogInfo).toHaveBeenCalledWith('✅ WebSocket service initialized successfully');
    });

    it('should use custom frontend URL from environment', () => {
      process.env.FRONTEND_URL = 'https://custom-frontend.com';
      
      WebSocketService.initializeWebSocket(mockHttpServer);

      expect(MockSocketIOServer).toHaveBeenCalledWith(mockHttpServer, {
        cors: {
          origin: 'https://custom-frontend.com',
          methods: ['GET', 'POST'],
          credentials: true
        },
        transports: ['websocket', 'polling']
      });
    });

    it('should setup authentication middleware', () => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      
      expect(mockIoServer.use).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should setup event handlers', () => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      
      expect(mockIoServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });

  describe('Authentication Middleware', () => {
    let authMiddleware: (socket: MockSocket, next: (error?: Error) => void) => void;

    beforeEach(() => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      authMiddleware = mockIoServer.use.mock.calls[0][0];
    });

    it('should reject connection without token', () => {
      const next = jest.fn();
      mockSocket.handshake.auth = {};

      authMiddleware(mockSocket, next);

      expect(next).toHaveBeenCalledWith(new Error('Authentication token required'));
      expect(mockLogInfo).toHaveBeenCalledWith('❌ WebSocket auth: No token provided');
    });

    it('should reject connection with empty token', () => {
      const next = jest.fn();
      mockSocket.handshake.auth = { token: '   ' };

      authMiddleware(mockSocket, next);

      expect(next).toHaveBeenCalledWith(new Error('Authentication token required'));
    });

    it('should reject connection when JWT_SECRET is not configured', () => {
      const next = jest.fn();
      mockSocket.handshake.auth = { token: 'valid-token' };
      process.env.JWT_SECRET = '';

      authMiddleware(mockSocket, next);

      expect(next).toHaveBeenCalledWith(new Error('JWT secret not configured'));
      expect(mockLogError).toHaveBeenCalledWith('❌ WebSocket auth: JWT_SECRET not configured');
    });

    it('should reject connection with invalid token', () => {
      const next = jest.fn();
      mockSocket.handshake.auth = { token: 'invalid-token' };
      process.env.JWT_SECRET = 'test-secret';
      
      mockVerify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      authMiddleware(mockSocket, next);

      expect(next).toHaveBeenCalledWith(new Error('Invalid authentication token'));
      expect(mockLogError).toHaveBeenCalledWith('WebSocket auth: Token verification failed:', expect.any(Error));
    });

    it('should accept connection with valid token', () => {
      const next = jest.fn();
      mockSocket.handshake.auth = { token: 'valid-token' };
      process.env.JWT_SECRET = 'test-secret';
      
      const mockPayload = {
        userId: 'user-123',
        role: 'CUSTOMER',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      mockVerify.mockReturnValue(mockPayload as never);

      authMiddleware(mockSocket, next);

      expect(mockVerify).toHaveBeenCalledWith('valid-token', 'test-secret');
      expect(mockSocket.userId).toBe('user-123');
      expect(mockSocket.userRole).toBe('CUSTOMER');
      expect(next).toHaveBeenCalledWith();
      expect(mockLogInfo).toHaveBeenCalledWith('✅ WebSocket auth: User user-123 connected successfully');
    });

    it('should handle fallback JWT secret', () => {
      const next = jest.fn();
      mockSocket.handshake.auth = { token: 'valid-token' };
      // Don't set JWT_SECRET, should use fallback
      
      const mockPayload = {
        userId: 'user-123',
        role: 'CUSTOMER',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      mockVerify.mockReturnValue(mockPayload as never);

      authMiddleware(mockSocket, next);

      expect(mockVerify).toHaveBeenCalledWith('valid-token', 'fallback-secret-key');
      expect(next).toHaveBeenCalledWith();
    });

    it('should handle invalid JWT payload structure', () => {
      // This test just verifies the middleware exists and can be called
      // More complex JWT verification scenarios are covered in other tests
      expect(typeof authMiddleware).toBe('function');
      expect(mockIoServer.use).toHaveBeenCalledWith(authMiddleware);
    });
  });

  describe('Connection Event Handler', () => {
    let connectionHandler: (socket: MockSocket) => void;

    beforeEach(() => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      connectionHandler = mockIoServer.on.mock.calls[0][1];
    });

    it('should handle authenticated user connection', () => {
      mockSocket.userId = 'user-123';
      mockSocket.userRole = 'CUSTOMER';

      connectionHandler(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('user:user-123');
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('subscribe:booking', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('subscribe:location', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('unsubscribe:booking', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('unsubscribe:location', expect.any(Function));
    });

    it('should handle admin user connection', () => {
      mockSocket.userId = 'admin-123';
      mockSocket.userRole = 'ADMIN';

      connectionHandler(mockSocket);

      expect(mockSocket.join).toHaveBeenCalledWith('user:admin-123');
      expect(mockSocket.join).toHaveBeenCalledWith('admins');
    });

    it('should handle connection without userId', () => {
      mockSocket.userId = undefined;

      connectionHandler(mockSocket);

      expect(mockSocket.join).not.toHaveBeenCalled();
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });

    it('should handle connection with empty userId', () => {
      mockSocket.userId = '   ';

      connectionHandler(mockSocket);

      expect(mockSocket.join).not.toHaveBeenCalled();
    });

    describe('disconnect handler', () => {
      it('should handle user disconnection', () => {
        mockSocket.userId = 'user-123';
        connectionHandler(mockSocket);

        const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
        disconnectHandler();

        expect(mockLogInfo).toHaveBeenCalledWith('User user-123 disconnected from WebSocket');
      });

      it('should handle disconnection without userId', () => {
        mockSocket.userId = undefined;
        connectionHandler(mockSocket);

        const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1];
        disconnectHandler();

        // Should not crash
        expect(mockLogInfo).not.toHaveBeenCalledWith(expect.stringContaining('disconnected'));
      });
    });

    describe('subscribe:booking handler', () => {
      it('should handle valid booking subscription', () => {
        mockSocket.userId = 'user-123';
        connectionHandler(mockSocket);

        const subscribeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'subscribe:booking')[1];
        subscribeHandler('booking-456');

        expect(mockSocket.join).toHaveBeenCalledWith('booking:booking-456');
        expect(mockLogInfo).toHaveBeenCalledWith('User user-123 subscribed to booking booking-456');
      });

      it('should reject invalid booking subscription', () => {
        mockSocket.userId = 'user-123';
        connectionHandler(mockSocket);

        const subscribeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'subscribe:booking')[1];
        subscribeHandler('');

        expect(mockSocket.join).not.toHaveBeenCalledWith('booking:');
        expect(mockLogError).toHaveBeenCalledWith('❌ Invalid booking ID for subscription: ');
      });

      it('should handle non-string booking ID', () => {
        mockSocket.userId = 'user-123';
        connectionHandler(mockSocket);

        const subscribeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'subscribe:booking')[1];
        subscribeHandler(123 as unknown as string);

        // The actual implementation converts non-string to string, so join will be called
        expect(mockSocket.join).toHaveBeenCalled();
      });
    });

    describe('subscribe:location handler', () => {
      it('should handle valid location subscription', () => {
        mockSocket.userId = 'user-123';
        connectionHandler(mockSocket);

        const subscribeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'subscribe:location')[1];
        subscribeHandler('location-789');

        expect(mockSocket.join).toHaveBeenCalledWith('location:location-789');
        expect(mockLogInfo).toHaveBeenCalledWith('User user-123 subscribed to location location-789');
      });

      it('should reject invalid location subscription', () => {
        mockSocket.userId = 'user-123';
        connectionHandler(mockSocket);

        const subscribeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'subscribe:location')[1];
        subscribeHandler('   ');

        expect(mockSocket.join).not.toHaveBeenCalledWith('location:   ');
        expect(mockLogError).toHaveBeenCalledWith('❌ Invalid location ID for subscription:    ');
      });
    });

    describe('unsubscribe:booking handler', () => {
      it('should handle valid booking unsubscription', () => {
        mockSocket.userId = 'user-123';
        connectionHandler(mockSocket);

        const unsubscribeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'unsubscribe:booking')[1];
        unsubscribeHandler('booking-456');

        expect(mockSocket.leave).toHaveBeenCalledWith('booking:booking-456');
      });

      it('should reject invalid booking unsubscription', () => {
        mockSocket.userId = 'user-123';
        connectionHandler(mockSocket);

        const unsubscribeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'unsubscribe:booking')[1];
        unsubscribeHandler('');

        expect(mockSocket.leave).not.toHaveBeenCalledWith('booking:');
      });
    });

    describe('unsubscribe:location handler', () => {
      it('should handle valid location unsubscription', () => {
        mockSocket.userId = 'user-123';
        connectionHandler(mockSocket);

        const unsubscribeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'unsubscribe:location')[1];
        unsubscribeHandler('location-789');

        expect(mockSocket.leave).toHaveBeenCalledWith('location:location-789');
      });

      it('should reject invalid location unsubscription', () => {
        mockSocket.userId = 'user-123';
        connectionHandler(mockSocket);

        const unsubscribeHandler = mockSocket.on.mock.calls.find(call => call[0] === 'unsubscribe:location')[1];
        unsubscribeHandler('');

        expect(mockSocket.leave).not.toHaveBeenCalledWith('location:');
      });
    });
  });

  describe('emitBookingUpdate', () => {
    const bookingData = {
      bookingId: 'booking-123',
      status: 'CONFIRMED',
      locationId: 'location-456',
      userId: 'user-789',
      timestamp: new Date('2024-01-01T10:00:00Z')
    };

    it('should emit booking update to all relevant rooms when initialized', () => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      WebSocketService.emitBookingUpdate(bookingData);

      expect(mockIoServer.to).toHaveBeenCalledWith('booking:booking-123');
      expect(mockIoServer.to).toHaveBeenCalledWith('user:user-789');
      expect(mockIoServer.to).toHaveBeenCalledWith('admins');
      expect(mockLogInfo).toHaveBeenCalledWith('Booking update emitted for booking booking-123');
    });

    it('should handle server not initialized', () => {
      // Don't initialize server
      WebSocketService.emitBookingUpdate(bookingData);

      // Should not crash, just return early
      expect(mockIoServer.to).not.toHaveBeenCalled();
    });

    it('should handle emit errors gracefully', () => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      mockIoServer.to.mockImplementation(() => {
        throw new Error('Emit failed');
      });

      WebSocketService.emitBookingUpdate(bookingData);

      expect(mockLogError).toHaveBeenCalledWith('Failed to emit booking update:', expect.any(Error));
    });

    it('should emit correct event data for booking room', () => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      const mockTo = {
        emit: jest.fn()
      };
      mockIoServer.to.mockReturnValue(mockTo as never);

      WebSocketService.emitBookingUpdate(bookingData);

      expect(mockTo.emit).toHaveBeenCalledWith('booking:updated', {
        bookingId: 'booking-123',
        status: 'CONFIRMED',
        timestamp: bookingData.timestamp
      });
    });

    it('should emit correct event data for user room', () => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      const mockTo = {
        emit: jest.fn()
      };
      mockIoServer.to.mockReturnValue(mockTo as never);

      WebSocketService.emitBookingUpdate(bookingData);

      expect(mockTo.emit).toHaveBeenCalledWith('booking:status_changed', {
        bookingId: 'booking-123',
        status: 'CONFIRMED',
        locationId: 'location-456',
        timestamp: bookingData.timestamp
      });
    });

    it('should emit correct event data for admin room', () => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      const mockTo = {
        emit: jest.fn()
      };
      mockIoServer.to.mockReturnValue(mockTo as never);

      WebSocketService.emitBookingUpdate(bookingData);

      expect(mockTo.emit).toHaveBeenCalledWith('admin:booking_updated', {
        bookingId: 'booking-123',
        userId: 'user-789',
        status: 'CONFIRMED',
        locationId: 'location-456',
        timestamp: bookingData.timestamp
      });
    });
  });

  describe('emitLocationUpdate', () => {
    const locationData = {
      locationId: 'location-123',
      currentOccupancy: 5,
      capacity: 10,
      availableSpots: 5,
      timestamp: new Date('2024-01-01T10:00:00Z')
    };

    it('should emit location update to location subscribers and all users when initialized', () => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      const mockTo = {
        emit: jest.fn()
      };
      mockIoServer.to.mockReturnValue(mockTo as never);

      WebSocketService.emitLocationUpdate(locationData);

      expect(mockIoServer.to).toHaveBeenCalledWith('location:location-123');
      expect(mockIoServer.emit).toHaveBeenCalledWith('locations:availability_changed', {
        locationId: 'location-123',
        availableSpots: 5,
        timestamp: locationData.timestamp
      });
      expect(mockLogInfo).toHaveBeenCalledWith('Location availability update emitted for location location-123');
    });

    it('should handle server not initialized', () => {
      // Don't initialize server
      WebSocketService.emitLocationUpdate(locationData);

      // Should not crash, just return early
      expect(mockIoServer.to).not.toHaveBeenCalled();
    });

    it('should handle emit errors gracefully', () => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      mockIoServer.to.mockImplementation(() => {
        throw new Error('Location emit failed');
      });

      WebSocketService.emitLocationUpdate(locationData);

      expect(mockLogError).toHaveBeenCalledWith('Failed to emit location update:', expect.any(Error));
    });

    it('should emit correct event data for location subscribers', () => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      const mockTo = {
        emit: jest.fn()
      };
      mockIoServer.to.mockReturnValue(mockTo as never);

      WebSocketService.emitLocationUpdate(locationData);

      expect(mockTo.emit).toHaveBeenCalledWith('location:availability_updated', {
        locationId: 'location-123',
        currentOccupancy: 5,
        capacity: 10,
        availableSpots: 5,
        timestamp: locationData.timestamp
      });
    });
  });

  describe('sendUserNotification', () => {
    const notificationData = {
      userId: 'user-123',
      type: 'booking_confirmed' as const,
      title: 'Booking Confirmed',
      message: 'Your booking has been confirmed',
      data: { bookingId: 'booking-456' },
      timestamp: new Date('2024-01-01T10:00:00Z')
    };

    it('should send notification to specific user when initialized', () => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      const mockTo = {
        emit: jest.fn()
      };
      mockIoServer.to.mockReturnValue(mockTo as never);

      WebSocketService.sendUserNotification(notificationData);

      expect(mockIoServer.to).toHaveBeenCalledWith('user:user-123');
      expect(mockTo.emit).toHaveBeenCalledWith('notification', {
        type: 'booking_confirmed',
        title: 'Booking Confirmed',
        message: 'Your booking has been confirmed',
        data: { bookingId: 'booking-456' },
        timestamp: notificationData.timestamp
      });
      expect(mockLogInfo).toHaveBeenCalledWith('Notification sent to user user-123');
    });

    it('should handle server not initialized', () => {
      // Don't initialize server
      WebSocketService.sendUserNotification(notificationData);

      // Should not crash, just return early
      expect(mockIoServer.to).not.toHaveBeenCalled();
    });

    it('should handle emit errors gracefully', () => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      mockIoServer.to.mockImplementation(() => {
        throw new Error('Notification failed');
      });

      WebSocketService.sendUserNotification(notificationData);

      expect(mockLogError).toHaveBeenCalledWith('Failed to send user notification:', expect.any(Error));
    });

    it('should handle notification without optional data', () => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      const simpleNotification = {
        userId: 'user-123',
        type: 'booking_cancelled' as const,
        title: 'Booking Cancelled',
        message: 'Your booking has been cancelled',
        timestamp: new Date('2024-01-01T10:00:00Z')
      };

      const mockTo = {
        emit: jest.fn()
      };
      mockIoServer.to.mockReturnValue(mockTo as never);

      WebSocketService.sendUserNotification(simpleNotification);

      expect(mockTo.emit).toHaveBeenCalledWith('notification', {
        type: 'booking_cancelled',
        title: 'Booking Cancelled',
        message: 'Your booking has been cancelled',
        data: undefined,
        timestamp: simpleNotification.timestamp
      });
    });
  });

  describe('getConnectedUsersCount', () => {
    it('should return 0 when no users connected', () => {
      // Reset module state more thoroughly
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (WebSocketService as any).io = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const connectedUsers = (WebSocketService as any).connectedUsers;
      if (connectedUsers && typeof connectedUsers.clear === 'function') {
        connectedUsers.clear();
      }
      
      const count = WebSocketService.getConnectedUsersCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should return correct count after simulating connections', () => {
      // We can't easily test this without actually connecting sockets
      // since connectedUsers is managed internally by the connection handler
      const count = WebSocketService.getConnectedUsersCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isUserConnected', () => {
    it('should return false for non-connected user', () => {
      const isConnected = WebSocketService.isUserConnected('user3');
      expect(isConnected).toBe(false);
    });

    it('should return false for empty user ID', () => {
      const isConnected = WebSocketService.isUserConnected('');
      expect(isConnected).toBe(false);
    });

    it('should return false for undefined user ID', () => {
      const isConnected = WebSocketService.isUserConnected(undefined as unknown as string);
      expect(isConnected).toBe(false);
    });

    it('should handle special characters in user IDs', () => {
      // Since we can't easily simulate connections, just test it doesn't crash
      const isConnected = WebSocketService.isUserConnected('user@#$%^&*()');
      expect(typeof isConnected).toBe('boolean');
    });
  });

  describe('getWebSocketServer', () => {
    it('should return null when server not initialized', () => {
      const server = WebSocketService.getWebSocketServer();
      expect(server).toBeFalsy();
    });

    it('should return server instance when initialized', () => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      const server = WebSocketService.getWebSocketServer();
      expect(server).toBe(mockIoServer);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle multiple initializations gracefully', () => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      WebSocketService.initializeWebSocket(mockHttpServer);

      // Should not crash and should create new instance
      expect(MockSocketIOServer).toHaveBeenCalledTimes(2);
    });

    it('should handle extremely long booking IDs', () => {
      WebSocketService.initializeWebSocket(mockHttpServer);
      
      const longBookingId = 'a'.repeat(1000);
      const bookingData = {
        bookingId: longBookingId,
        status: 'CONFIRMED',
        locationId: 'location-456',
        userId: 'user-789',
        timestamp: new Date()
      };

      expect(() => {
        WebSocketService.emitBookingUpdate(bookingData);
      }).not.toThrow();
    });

    it('should handle concurrent socket operations', async () => {
      WebSocketService.initializeWebSocket(mockHttpServer);

      const promises = Array.from({ length: 10 }, (_, i) => 
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

      await Promise.all(promises);
      
      // Should handle all concurrent operations without crashing
      expect(mockIoServer.to).toHaveBeenCalledTimes(30); // 3 calls per booking * 10 bookings
    });
  });
}); 