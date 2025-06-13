import { Response, NextFunction } from 'express';

import { verifyToken } from '../services/AuthService';
import { AppError, AuthenticatedRequest, UserRole } from '../types';

export const authenticate = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader === undefined || authHeader === null || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    const token = authHeader.substring(7).trim();
    
    if (token.length === 0) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
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
      res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
  }
};

export const authorize = (roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (req.user === undefined || req.user === null) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Forbidden: access denied'
      });
      return;
    }

    next();
  };
}; 