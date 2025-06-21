import { Response, NextFunction } from 'express';

import { verifyToken } from '../services/AuthService';
import { AppError, AuthenticatedRequest, UserRole } from '../types';
import { sendError } from '../utils/responseHelpers';

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ') !== true) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const token = authHeader.substring(7).trim();
    
    if (token.length === 0) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const payload = verifyToken(token);
    
    req.user = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role
    };

    next();
  } catch (error) {
    if (error instanceof AppError) {
      sendError(res, error.message, error.statusCode);
    } else {
      sendError(res, 'Invalid token', 401);
    }
  }
};

export const authorize = (roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (req.user === undefined || req.user === null) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    if (!roles.includes(req.user.role)) {
      sendError(res, 'Forbidden: access denied', 403);
      return;
    }

    next();
  };
}; 