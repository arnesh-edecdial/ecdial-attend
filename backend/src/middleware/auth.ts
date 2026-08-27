import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/store';
import { Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'ecdial_secret_jwt_key_2026_super_secure';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    employeeCode: string;
    name: string;
    email: string;
    role: Role;
    department?: string | null;
    phone?: string | null;
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (!decoded || !decoded.id) {
      res.status(401).json({ success: false, message: 'Invalid token payload.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        employeeCode: true,
        name: true,
        email: true,
        role: true,
        department: true,
        phone: true,
        isActive: true,
      },
    });

    if (!user) {
      res.status(401).json({ success: false, message: 'User account not found.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        errorType: 'ACCOUNT_INACTIVE',
        message: 'Account is inactive or deactivated. Please contact Admin.',
      });
      return;
    }

    req.user = {
      id: user.id,
      employeeCode: user.employeeCode,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      phone: user.phone,
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
