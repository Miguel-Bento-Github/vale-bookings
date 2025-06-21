import { Server as HTTPServer } from 'http';

import jwt from 'jsonwebtoken';
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

class WebSocketService {
  private io: SocketIOServer | null = null;
  private connectedUsers = new Map<string, string>(); // socketId -> userId

  /**
     * Initialize WebSocket server
     */
  initialize(httpServer: HTTPServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL ?? 'http://localhost:9000',
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();

    logInfo('WebSocket service initialized');
  }

  /**
     * Setup authentication middleware
     */
  private setupMiddleware(): void {
    if (!this.io) return;

    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token as string;

      if (!token || token.trim() === '') {
        return next(new Error('Authentication token required'));
      }

      try {
        const jwtSecret = process.env.JWT_SECRET;
        if (jwtSecret === undefined || jwtSecret.trim() === '') {
          return next(new Error('JWT secret not configured'));
        }

        const decoded = jwt.verify(token, jwtSecret) as SocketAuthPayload;
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
  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      const authSocket = socket as AuthenticatedSocket;
      const userId = authSocket.userId;

      if (userId !== undefined && userId.trim() !== '') {
        this.connectedUsers.set(socket.id, userId);
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
          this.connectedUsers.delete(socket.id);
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
     * Emit booking status update
     */
  emitBookingUpdate(data: BookingUpdateData): void {
    if (!this.io) return;

    try {
      // Emit to specific booking subscribers
      this.io.to(`booking:${data.bookingId}`).emit('booking:updated', {
        bookingId: data.bookingId,
        status: data.status,
        timestamp: data.timestamp
      });

      // Emit to user's personal room
      this.io.to(`user:${data.userId}`).emit('booking:status_changed', {
        bookingId: data.bookingId,
        status: data.status,
        locationId: data.locationId,
        timestamp: data.timestamp
      });

      // Emit to admins
      this.io.to('admins').emit('admin:booking_updated', {
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
  emitLocationUpdate(data: LocationUpdateData): void {
    if (!this.io) return;

    try {
      // Emit to location subscribers
      this.io.to(`location:${data.locationId}`).emit('location:availability_updated', {
        locationId: data.locationId,
        currentOccupancy: data.currentOccupancy,
        capacity: data.capacity,
        availableSpots: data.availableSpots,
        timestamp: data.timestamp
      });

      // Emit to all users for map updates
      this.io.emit('locations:availability_changed', {
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
  sendUserNotification(data: UserNotificationData): void {
    if (!this.io) return;

    try {
      this.io.to(`user:${data.userId}`).emit('notification', {
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
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }

  /**
     * Check if user is connected
     */
  isUserConnected(userId: string): boolean {
    return Array.from(this.connectedUsers.values()).includes(userId);
  }

  /**
     * Get server instance for testing
     */
  getServer(): SocketIOServer | null {
    return this.io;
  }
}

export const webSocketService = new WebSocketService();
export default webSocketService; 