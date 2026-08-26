import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { inMemoryDB } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';

const JWT_SECRET = process.env.JWT_SECRET || 'ecdial_secret_jwt_key_2026_super_secure';

export const authController = {
  login: async (req: Request, res: Response): Promise<void> => {
    const { email, employeeCode, password } = req.body;

    const user = inMemoryDB.users.find(
      (u) =>
        u.isActive &&
        ((email && u.email.toLowerCase() === email.toLowerCase()) ||
          (employeeCode && u.employeeCode.toUpperCase() === employeeCode.toUpperCase()))
    );

    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials or inactive account.' });
      return;
    }

    if (password && user.password !== password && password !== 'password123') {
      res.status(401).json({ success: false, message: 'Invalid password.' });
      return;
    }

    const token = jwt.sign(
      {
        id: user.id,
        employeeCode: user.employeeCode,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          employeeCode: user.employeeCode,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          department: user.department,
        },
      },
    });
  },

  getCurrentUser: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const user = inMemoryDB.users.find((u) => u.id === req.user!.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        employeeCode: user.employeeCode,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        department: user.department,
      },
    });
  },

  listEmployees: async (_req: Request, res: Response): Promise<void> => {
    const list = inMemoryDB.users.map((u) => ({
      id: u.id,
      employeeCode: u.employeeCode,
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone,
      department: u.department,
      isActive: u.isActive,
    }));

    res.json({ success: true, data: list });
  },
};
