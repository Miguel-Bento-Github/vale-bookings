import { Server as HTTPServer } from 'http';

import { verify } from 'jsonwebtoken';
import { Server as SocketIOServer, Socket } from 'socket.io';

import { logInfo, logError } from '../utils/logger';

interface AuthenticatedSocket extends Socket {
    userId?: string;
    userRole?: string;
}

interface SocketAuthPayload {
    userId: string;
    role: string;
    iat: number;
    exp: number;
}

interface BookingUpdateData {
    bookingId: string;
    status: string;
    locationId: string;
    userId: string;
    timestamp: Date;
}

interface LocationUpdateData {
    locationId: string;
    currentOccupancy: number;
    capacity: number;
    availableSpots: number;
    timestamp: Date;
}

interface UserNotificationData {
    userId: string;
    type: 'booking_confirmed' | 'booking_cancelled' | 'booking_completed' | 'location_available';
    title: string;
    message: string;
    data?: Record<string, unknown>;
    timestamp: Date;
}

// Module-level state
let io: SocketIOServer | null = null;
const connectedUsers = new Map<string, string>(); // socketId -> userId

/**
 * Setup authentication middleware
 */
function setupMiddleware(): void {
  if (!io) return;

  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string;

    if (!token || token.trim() === '') {
      return next(new Error('Authentication token required'));
    }

    try {
      const jwtSecret = process.env.JWT_SECRET;
      if (jwtSecret === undefined || jwtSecret.trim() === '') {
        return next(new Error('JWT secret not configured'));
      }

      const decoded = verify(token, jwtSecret) as SocketAuthPayload;
      (socket as AuthenticatedSocket).userId = decoded.userId;
      (socket as AuthenticatedSocket).userRole = decoded.role;
      next();
    } catch {
      next(new Error('Invalid authentication token'));
    }
  });
}

/**
 * Setup event handlers
 */
function setupEventHandlers(): void {
  if (!io) return;

  io.on('connection', (socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.userId;

    if (userId !== undefined && userId.trim() !== '') {
      connectedUsers.set(socket.id, userId);
      logInfo(`User ${userId} connected via WebSocket`);

      // Join user-specific room
      void socket.join(`user:${userId}`);

      // Join role-specific room if admin
      if (authSocket.userRole === 'ADMIN') {
        void socket.join('admins');
      }
    }

    // Handle disconnection
    socket.on('disconnect', () => {
      if (userId !== undefined && userId.trim() !== '') {
        connectedUsers.delete(socket.id);
        logInfo(`User ${userId} disconnected from WebSocket`);
      }
    });

    // Handle booking status subscription
    socket.on('subscribe:booking', (bookingId: string) => {
      if (typeof bookingId === 'string' && bookingId.trim() !== '') {
        void socket.join(`booking:${bookingId}`);
        logInfo(`User ${userId ?? 'unknown'} subscribed to booking ${bookingId}`);
      }
    });

    // Handle location availability subscription
    socket.on('subscribe:location', (locationId: string) => {
      if (typeof locationId === 'string' && locationId.trim() !== '') {
        void socket.join(`location:${locationId}`);
        logInfo(`User ${userId ?? 'unknown'} subscribed to location ${locationId}`);
      }
    });

    // Handle unsubscription
    socket.on('unsubscribe:booking', (bookingId: string) => {
      if (typeof bookingId === 'string' && bookingId.trim() !== '') {
        void socket.leave(`booking:${bookingId}`);
      }
    });

    socket.on('unsubscribe:location', (locationId: string) => {
      if (typeof locationId === 'string' && locationId.trim() !== '') {
        void socket.leave(`location:${locationId}`);
      }
    });
  });
}

/**
 * Initialize WebSocket server
 */
export function initializeWebSocket(httpServer: HTTPServer): void {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL ?? 'http://localhost:9000',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  setupMiddleware();
  setupEventHandlers();

  logInfo('WebSocket service initialized');
}

/**
 * Emit booking status update
 */
export function emitBookingUpdate(data: BookingUpdateData): void {
  if (!io) return;

  try {
    // Emit to specific booking subscribers
    io.to(`booking:${data.bookingId}`).emit('booking:updated', {
      bookingId: data.bookingId,
      status: data.status,
      timestamp: data.timestamp
    });

    // Emit to user's personal room
    io.to(`user:${data.userId}`).emit('booking:status_changed', {
      bookingId: data.bookingId,
      status: data.status,
      locationId: data.locationId,
      timestamp: data.timestamp
    });

    // Emit to admins
    io.to('admins').emit('admin:booking_updated', {
      bookingId: data.bookingId,
      userId: data.userId,
      status: data.status,
      locationId: data.locationId,
      timestamp: data.timestamp
    });

    logInfo(`Booking update emitted for booking ${data.bookingId}`);
  } catch (error) {
    logError('Failed to emit booking update:', error);
  }
}

/**
 * Emit location availability update
 */
export function emitLocationUpdate(data: LocationUpdateData): void {
  if (!io) return;

  try {
    // Emit to location subscribers
    io.to(`location:${data.locationId}`).emit('location:availability_updated', {
      locationId: data.locationId,
      currentOccupancy: data.currentOccupancy,
      capacity: data.capacity,
      availableSpots: data.availableSpots,
      timestamp: data.timestamp
    });

    // Emit to all users for map updates
    io.emit('locations:availability_changed', {
      locationId: data.locationId,
      availableSpots: data.availableSpots,
      timestamp: data.timestamp
    });

    logInfo(`Location availability update emitted for location ${data.locationId}`);
  } catch (error) {
    logError('Failed to emit location update:', error);
  }
}

/**
 * Send notification to specific user
 */
export function sendUserNotification(data: UserNotificationData): void {
  if (!io) return;

  try {
    io.to(`user:${data.userId}`).emit('notification', {
      type: data.type,
      title: data.title,
      message: data.message,
      data: data.data,
      timestamp: data.timestamp
    });

    logInfo(`Notification sent to user ${data.userId}`);
  } catch (error) {
    logError('Failed to send user notification:', error);
  }
}

/**
 * Get connected users count
 */
export function getConnectedUsersCount(): number {
  return connectedUsers.size;
}

/**
 * Check if user is connected
 */
export function isUserConnected(userId: string): boolean {
  return Array.from(connectedUsers.values()).includes(userId);
}

/**
 * Get server instance for testing
 */
export function getWebSocketServer(): SocketIOServer | null {
  return io;
} 