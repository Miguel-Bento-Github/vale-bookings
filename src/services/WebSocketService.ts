import { Server as HTTPServer } from 'http';

import { Server as SocketIOServer, Socket } from 'socket.io';

import { logInfo, logError } from '../utils/logger';
import { verifyTokenSafely } from '../utils/tokenUtils';

interface AuthenticatedSocket extends Socket {
    userId?: string;
    userRole?: string;
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

interface UserManagementData {
    userId: string;
    action: 'created' | 'updated' | 'deleted';
    userEmail?: string;
    userRole?: string;
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

  console.info('=== Setting Up WebSocket Authentication Middleware ===');

  io.use((socket, next) => {
    try {
      console.info('🔐 New WebSocket connection attempt from:', socket.handshake.address);
      console.info('Connection headers:', {
        origin: socket.handshake.headers.origin,
        userAgent: socket.handshake.headers['user-agent']?.substring(0, 50) + '...',
        referer: socket.handshake.headers.referer
      });

      const token = socket.handshake.auth.token as string;
      console.info('Auth token received:', {
        hasToken: !!token,
        tokenLength: token?.length || 0,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'none'
      });

      if (!token || token.trim() === '') {
        logInfo('❌ WebSocket auth: No token provided');
        return next(new Error('Authentication token required'));
      }

      try {
        const jwtSecret = process.env.JWT_SECRET ?? 'your-super-secret-jwt-key-change-this-in-production';
        if (jwtSecret.trim() === '') {
          logError('❌ WebSocket auth: JWT_SECRET not configured');
          return next(new Error('JWT secret not configured'));
        }

        console.info('🔍 Verifying JWT token...');
        const decoded = verifyTokenSafely(token);
        
        if (!decoded) {
          logInfo('❌ WebSocket auth: Token verification failed (expired or invalid)');
          return next(new Error('Authentication failed: Token expired or invalid'));
        }
        
        console.info('✅ JWT verification successful:', {
          userId: decoded.userId,
          role: decoded.role,
          email: decoded.email
        });
        
        logInfo(`✅ WebSocket auth: User ${decoded.userId} connected successfully`);
        
        (socket as AuthenticatedSocket).userId = decoded.userId;
        (socket as AuthenticatedSocket).userRole = decoded.role;
        next();
      } catch (jwtError) {
        console.error('❌ JWT verification failed:', jwtError);
        logError('WebSocket auth: Token verification failed:', jwtError);
        
        // Don't crash the server - just reject this connection
        const errorMessage = jwtError instanceof Error ? jwtError.message : 'Invalid authentication token';
        next(new Error(`Authentication failed: ${errorMessage}`));
      }
    } catch (middlewareError) {
      console.error('❌ WebSocket middleware error:', middlewareError);
      logError('WebSocket middleware error:', middlewareError);
      
      // Don't crash the server - just reject this connection
      next(new Error('Internal server error during authentication'));
    }
  });

  console.info('✅ WebSocket authentication middleware configured');
}

/**
 * Setup event handlers
 */
function setupEventHandlers(): void {
  if (!io) return;

  console.info('=== Setting Up WebSocket Event Handlers ===');

  io.on('connection', (socket) => {
    try {
      const authSocket = socket as AuthenticatedSocket;
      const userId = authSocket.userId;

      console.info('🎯 New authenticated connection:', {
        socketId: socket.id,
        userId: userId,
        userRole: authSocket.userRole,
        timestamp: new Date().toISOString()
      });

      if (userId !== undefined && userId.trim() !== '') {
        connectedUsers.set(socket.id, userId);
        console.info(`📥 User ${userId} joined WebSocket (total connections: ${connectedUsers.size})`);

        // Join user-specific room with error handling
        try {
          const joinResult = socket.join(`user:${userId}`);
          if (joinResult && typeof joinResult.catch === 'function') {
            joinResult.catch((error: unknown) => {
              console.error(`❌ Failed to join user room for ${userId}:`, error);
              logError(`Failed to join user room for ${userId}:`, error);
            });
          }
        } catch (error) {
          console.error(`❌ Failed to join user room for ${userId}:`, error);
          logError(`Failed to join user room for ${userId}:`, error);
        }
        console.info(`🏠 User ${userId} joined room: user:${userId}`);

        // Join role-specific room if admin
        if (authSocket.userRole === 'ADMIN') {
          try {
            const joinResult = socket.join('admins');
            if (joinResult && typeof joinResult.catch === 'function') {
              joinResult.catch((error: unknown) => {
                console.error(`❌ Failed to join admins room for ${userId}:`, error);
                logError(`Failed to join admins room for ${userId}:`, error);
              });
            }
          } catch (error) {
            console.error(`❌ Failed to join admins room for ${userId}:`, error);
            logError(`Failed to join admins room for ${userId}:`, error);
          }
          console.info(`👑 Admin ${userId} joined admins room`);
        }
      }

      // Handle disconnection
      socket.on('disconnect', () => {
        try {
          if (userId !== undefined && userId.trim() !== '') {
            connectedUsers.delete(socket.id);
            console.info(`📤 User ${userId} disconnected from WebSocket (remaining: ${connectedUsers.size})`);
            logInfo(`User ${userId} disconnected from WebSocket`);
          }
        } catch (error) {
          console.error('❌ Error during disconnect handling:', error);
          logError('Error during disconnect handling:', error);
        }
      });

      // Handle booking status subscription
      socket.on('subscribe:booking', (bookingId: string) => {
        try {
          logInfo(`🔔 Subscribe request - User: ${userId}, Booking: ${bookingId}`);
          if (typeof bookingId === 'string' && bookingId.trim() !== '') {
            try {
              const joinResult = socket.join(`booking:${bookingId}`);
              if (joinResult && typeof joinResult.catch === 'function') {
                joinResult.catch((error: unknown) => {
                  console.error(`❌ Failed to join booking room ${bookingId}:`, error);
                  logError(`Failed to join booking room ${bookingId}:`, error);
                });
              }
            } catch (error) {
              console.error(`❌ Failed to join booking room ${bookingId}:`, error);
              logError(`Failed to join booking room ${bookingId}:`, error);
            }
            logInfo(`✅ User ${userId ?? 'unknown'} subscribed to booking:${bookingId}`);
            logInfo(`User ${userId ?? 'unknown'} subscribed to booking ${bookingId}`);
          } else {
            logError(`❌ Invalid booking ID for subscription: ${bookingId}`);
          }
        } catch (error) {
          console.error('❌ Error in booking subscription:', error);
          logError('Error in booking subscription:', error);
        }
      });

      // Handle location availability subscription
      socket.on('subscribe:location', (locationId: string) => {
        try {
          logInfo(`🔔 Subscribe request - User: ${userId}, Location: ${locationId}`);
          if (typeof locationId === 'string' && locationId.trim() !== '') {
            try {
              const joinResult = socket.join(`location:${locationId}`);
              if (joinResult && typeof joinResult.catch === 'function') {
                joinResult.catch((error: unknown) => {
                  console.error(`❌ Failed to join location room ${locationId}:`, error);
                  logError(`Failed to join location room ${locationId}:`, error);
                });
              }
            } catch (error) {
              console.error(`❌ Failed to join location room ${locationId}:`, error);
              logError(`Failed to join location room ${locationId}:`, error);
            }
            logInfo(`✅ User ${userId ?? 'unknown'} subscribed to location:${locationId}`);
            logInfo(`User ${userId ?? 'unknown'} subscribed to location ${locationId}`);
          } else {
            logError(`❌ Invalid location ID for subscription: ${locationId}`);
          }
        } catch (error) {
          console.error('❌ Error in location subscription:', error);
          logError('Error in location subscription:', error);
        }
      });

      // Handle unsubscription
      socket.on('unsubscribe:booking', (bookingId: string) => {
        try {
          console.info(`🔕 Unsubscribe request - User: ${userId}, Booking: ${bookingId}`);
          if (typeof bookingId === 'string' && bookingId.trim() !== '') {
            try {
              const leaveResult = socket.leave(`booking:${bookingId}`);
              if (leaveResult && typeof leaveResult.catch === 'function') {
                leaveResult.catch((error: unknown) => {
                  console.error(`❌ Failed to leave booking room ${bookingId}:`, error);
                  logError(`Failed to leave booking room ${bookingId}:`, error);
                });
              }
            } catch (error) {
              console.error(`❌ Failed to leave booking room ${bookingId}:`, error);
              logError(`Failed to leave booking room ${bookingId}:`, error);
            }
            console.info(`✅ User ${userId ?? 'unknown'} unsubscribed from booking:${bookingId}`);
          }
        } catch (error) {
          console.error('❌ Error in booking unsubscription:', error);
          logError('Error in booking unsubscription:', error);
        }
      });

      socket.on('unsubscribe:location', (locationId: string) => {
        try {
          console.info(`🔕 Unsubscribe request - User: ${userId}, Location: ${locationId}`);
          if (typeof locationId === 'string' && locationId.trim() !== '') {
            try {
              const leaveResult = socket.leave(`location:${locationId}`);
              if (leaveResult && typeof leaveResult.catch === 'function') {
                leaveResult.catch((error: unknown) => {
                  console.error(`❌ Failed to leave location room ${locationId}:`, error);
                  logError(`Failed to leave location room ${locationId}:`, error);
                });
              }
            } catch (error) {
              console.error(`❌ Failed to leave location room ${locationId}:`, error);
              logError(`Failed to leave location room ${locationId}:`, error);
            }
            console.info(`✅ User ${userId ?? 'unknown'} unsubscribed from location:${locationId}`);
          }
        } catch (error) {
          console.error('❌ Error in location unsubscription:', error);
          logError('Error in location unsubscription:', error);
        }
      });

    } catch (connectionError) {
      console.error('❌ Error during WebSocket connection setup:', connectionError);
      logError('Error during WebSocket connection setup:', connectionError);
      
      // Disconnect the problematic socket to prevent further issues
      socket.disconnect(true);
    }
  });

  console.info('✅ WebSocket event handlers configured');
}

/**
 * Initialize WebSocket server
 */
export function initializeWebSocket(httpServer: HTTPServer): void {
  try {
    console.info('=== Initializing WebSocket Server ===');
    
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:9000';
    console.info('CORS settings:', {
      origin: frontendUrl,
      methods: ['GET', 'POST'],
      credentials: true
    });

    io = new SocketIOServer(httpServer, {
      cors: {
        origin: frontendUrl,
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    console.info('Socket.IO server created, setting up middleware and handlers...');
    
    try {
      setupMiddleware();
      setupEventHandlers();
    } catch (setupError) {
      console.error('❌ Error setting up WebSocket middleware/handlers:', setupError);
      logError('Error setting up WebSocket middleware/handlers:', setupError);
      // Continue running - the server will work without WebSocket
    }

    // Add error handling for the IO server itself
    io.on('error', (error) => {
      console.error('❌ Socket.IO server error:', error);
      logError('Socket.IO server error:', error);
    });

    logInfo('✅ WebSocket service initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize WebSocket server:', error);
    logError('Failed to initialize WebSocket server:', error);
    // Don't throw - let the server continue running without WebSocket
  }
}

/**
 * Emit booking status update
 */
export function emitBookingUpdate(data: BookingUpdateData): void {
  try {
    console.info('📡 === Emitting Booking Update ===');
    console.info('Booking update data:', {
      bookingId: data.bookingId,
      status: data.status,
      userId: data.userId,
      locationId: data.locationId,
      timestamp: data.timestamp.toISOString()
    });

    if (!io) {
      console.error('❌ Cannot emit booking update - WebSocket server not initialized');
      return;
    }

    console.info('Connected users count:', connectedUsers.size);
    console.info('Connected users:', Array.from(connectedUsers.values()));

    try {
      console.info('📢 Emitting to rooms:');
      
      // Emit to specific booking subscribers
      const bookingRoom = `booking:${data.bookingId}`;
      console.info(`  - ${bookingRoom}`);
      io.to(bookingRoom).emit('booking:updated', {
        bookingId: data.bookingId,
        status: data.status,
        timestamp: data.timestamp
      });

      // Emit to user's personal room
      const userRoom = `user:${data.userId}`;
      console.info(`  - ${userRoom}`);
      io.to(userRoom).emit('booking:status_changed', {
        bookingId: data.bookingId,
        status: data.status,
        locationId: data.locationId,
        timestamp: data.timestamp
      });

      // Emit to admins
      console.info('  - admins');
      io.to('admins').emit('admin:booking_updated', {
        bookingId: data.bookingId,
        userId: data.userId,
        status: data.status,
        locationId: data.locationId,
        timestamp: data.timestamp
      });

      console.info('✅ All booking update events emitted successfully');
      logInfo(`Booking update emitted for booking ${data.bookingId}`);
    } catch (emitError) {
      console.error('❌ Failed to emit booking update events:', emitError);
      logError('Failed to emit booking update events:', emitError);
    }
  } catch (error) {
    console.error('❌ Error in emitBookingUpdate function:', error);
    logError('Error in emitBookingUpdate function:', error);
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
 * Force logout for specific user (token invalidated)
 */
export function forceUserLogout(userId: string, reason: string = 'Token invalidated'): void {
  if (!io) return;

  try {
    logInfo(`🚪 Forcing logout for user ${userId}: ${reason}`);
    
    // Emit logout event to user's personal room
    io.to(`user:${userId}`).emit('auth:force_logout', {
      reason,
      timestamp: new Date()
    });

    // Find and disconnect all sockets for this user
    const socketsToDisconnect: string[] = [];
    for (const [socketId, connectedUserId] of connectedUsers.entries()) {
      if (connectedUserId === userId) {
        socketsToDisconnect.push(socketId);
      }
    }

    // Disconnect user's sockets
    socketsToDisconnect.forEach(socketId => {
      if (io) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
          logInfo(`🔌 Disconnecting socket ${socketId} for user ${userId}`);
          socket.disconnect(true);
        }
      }
      connectedUsers.delete(socketId);
    });

    logInfo(`✅ User ${userId} logout completed - disconnected ${socketsToDisconnect.length} socket(s)`);
  } catch (error) {
    logError('Failed to force user logout:', error);
  }
}

/**
 * Force logout for all users (global token invalidation)
 */
export function forceAllUsersLogout(reason: string = 'System maintenance'): void {
  if (!io) return;

  try {
    logInfo(`🚪 Forcing logout for all users: ${reason}`);
    
    // Emit to all connected users
    io.emit('auth:force_logout', {
      reason,
      timestamp: new Date()
    });

    // Disconnect all sockets
    io.disconnectSockets(true);
    connectedUsers.clear();

    logInfo(`✅ All users logged out - reason: ${reason}`);
  } catch (error) {
    logError('Failed to force all users logout:', error);
  }
}

/**
 * Emit user management update (for admin dashboard)
 */
export function emitUserManagementUpdate(data: UserManagementData): void {
  if (!io) return;

  try {
    // Emit to admins only
    io.to('admins').emit('admin:user_updated', {
      userId: data.userId,
      action: data.action,
      userEmail: data.userEmail,
      userRole: data.userRole,
      timestamp: data.timestamp
    });

    logInfo(`User management update emitted: ${data.action} for user ${data.userId}`);
  } catch (error) {
    logError('Failed to emit user management update:', error);
  }
}

/**
 * Get server instance for testing
 */
export function getWebSocketServer(): SocketIOServer | null {
  return io;
} 