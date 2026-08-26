import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { inMemoryDB } from '../db/store';
import { Role } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'ecdial_secret_jwt_key_2026_super_secure';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    employeeCode: string;
    name: string;
    email: string;
    role: Role;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const directEmployeeId = req.headers['x-employee-id'] as string;

  // 1. Direct header simulation for fast multi-role switching / dev testing
  if (directEmployeeId) {
    const foundUser = inMemoryDB.users.find((u) => u.id === directEmployeeId || u.employeeCode === directEmployeeId);
    if (foundUser) {
      req.user = {
        id: foundUser.id,
        employeeCode: foundUser.employeeCode,
        name: foundUser.name,
        email: foundUser.email,
        role: foundUser.role,
      };
      return next();
    }
  }

  // 2. JWT Bearer Token
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Default fallback to first active user if in development demo mode
    const defaultUser = inMemoryDB.users.find((u) => u.role === 'ADMIN') || inMemoryDB.users[0];
    if (defaultUser && process.env.NODE_ENV !== 'production') {
      req.user = {
        id: defaultUser.id,
        employeeCode: defaultUser.employeeCode,
        name: defaultUser.name,
        email: defaultUser.email,
        role: defaultUser.role,
      };
      return next();
    }
    res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: decoded.id,
      employeeCode: decoded.employeeCode,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role,
    };
    next();
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired session. Please log in again.' });
  }
}

export function requireRole(allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Authorized roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}
