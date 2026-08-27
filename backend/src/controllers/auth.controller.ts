import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'ecdial_secret_jwt_key_2026_super_secure';

export const authController = {
  // 1. User Login with DB Verification & Bcrypt
  login: async (req: Request, res: Response): Promise<void> => {
    const { email, employeeCode, password } = req.body;

    if (!password) {
      res.status(400).json({ success: false, message: 'Password is required.' });
      return;
    }

    if (!email && !employeeCode) {
      res.status(400).json({ success: false, message: 'Email or Employee Code is required.' });
      return;
    }

    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            ...(email ? [{ email: { equals: email.toLowerCase().trim(), mode: 'insensitive' as any } }] : []),
            ...(employeeCode ? [{ employeeCode: { equals: employeeCode.toUpperCase().trim(), mode: 'insensitive' as any } }] : []),
          ],
        },
        include: {
          schedules: true,
        },
      });

      if (!user) {
        res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({
          success: false,
          errorType: 'ACCOUNT_INACTIVE',
          message: 'Account is inactive. Please contact Admin.',
        });
        return;
      }

      // Verify bcrypt password
      const isMatch = await bcrypt.compare(password, user.password).catch(() => false);
      if (!isMatch) {
        res.status(401).json({ success: false, message: 'Invalid password. Please try again.' });
        return;
      }

      // Check if user has schedules configured; if not, create default schedules
      if (user.schedules.length === 0) {
        for (let day = 0; day <= 6; day++) {
          await prisma.employeeSchedule.create({
            data: {
              employeeId: user.id,
              dayOfWeek: day,
              startTime: '09:00',
              endTime: '18:00',
              isWorkingDay: day !== 0,
            },
          }).catch(() => null);
        }
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
            isActive: user.isActive,
          },
        },
      });
    } catch (err: any) {
      console.error('[DB Login Error]', err);
      res.status(500).json({ success: false, message: 'Internal server authentication error.' });
    }
  },

  // 2. Get Current Authenticated User Profile
  getCurrentUser: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        include: {
          schedules: {
            orderBy: { dayOfWeek: 'asc' },
          },
        },
      });

      if (!user) {
        res.status(404).json({ success: false, message: 'User not found in database.' });
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
          isActive: user.isActive,
          schedules: user.schedules,
        },
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to retrieve profile.' });
    }
  },

  // 3. List Employees (Admin/Manager sees all with status and schedules)
  listEmployees: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const isPrivileged = req.user?.role === Role.ADMIN || req.user?.role === Role.IT_ADMIN || req.user?.role === Role.MANAGER;

      const users = await prisma.user.findMany({
        where: isPrivileged ? {} : { isActive: true },
        include: {
          schedules: {
            orderBy: { dayOfWeek: 'asc' },
          },
        },
        orderBy: { name: 'asc' },
      });

      const list = users.map((u) => {
        const monSatSched = u.schedules.find((s) => s.dayOfWeek === 1);
        const scheduleStr = monSatSched ? `${monSatSched.startTime} - ${monSatSched.endTime}` : '09:00 - 18:00';

        return {
          id: u.id,
          employeeCode: u.employeeCode,
          name: u.name,
          email: u.email,
          role: u.role,
          phone: u.phone,
          department: u.department,
          isActive: u.isActive,
          schedule: scheduleStr,
          schedules: u.schedules,
          createdAt: u.createdAt,
        };
      });

      res.json({ success: true, data: list });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to list employees.' });
    }
  },

  // 4. Admin Create Employee (Lifecycle & Schedule Assignment)
  createEmployee: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const {
      name,
      email,
      employeeCode,
      password = 'Password@123',
      role = 'TECHNICIAN',
      phone,
      department,
      isActive = true,
      startTime = '09:00',
      endTime = '18:00',
    } = req.body;

    if (!name || !email || !employeeCode) {
      res.status(400).json({ success: false, message: 'Name, Email, and Employee Code are required.' });
      return;
    }

    try {
      const emailClean = email.toLowerCase().trim();
      const codeClean = employeeCode.toUpperCase().trim();

      const existingEmail = await prisma.user.findUnique({ where: { email: emailClean } });
      if (existingEmail) {
        res.status(400).json({ success: false, message: `Email '${emailClean}' is already in use.` });
        return;
      }

      const existingCode = await prisma.user.findUnique({ where: { employeeCode: codeClean } });
      if (existingCode) {
        res.status(400).json({ success: false, message: `Employee Code '${codeClean}' is already in use.` });
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const roleEnum = (Role as any)[role] || Role.TECHNICIAN;

      const newUser = await prisma.user.create({
        data: {
          name: name.trim(),
          email: emailClean,
          employeeCode: codeClean,
          password: hashedPassword,
          role: roleEnum,
          phone: phone ? phone.trim() : null,
          department: department ? department.trim() : null,
          isActive: Boolean(isActive),
        },
      });

      // Create weekly schedule records for days 0 to 6
      for (let day = 0; day <= 6; day++) {
        const isWorkingDay = day !== 0; // Sunday is Off
        await prisma.employeeSchedule.create({
          data: {
            employeeId: newUser.id,
            dayOfWeek: day,
            startTime: startTime || '09:00',
            endTime: endTime || '18:00',
            isWorkingDay,
          },
        });
      }

      res.json({
        success: true,
        message: `Employee '${newUser.name}' created successfully.`,
        data: {
          id: newUser.id,
          employeeCode: newUser.employeeCode,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          phone: newUser.phone,
          department: newUser.department,
          isActive: newUser.isActive,
        },
      });
    } catch (err: any) {
      console.error('[Create Employee Error]', err);
      res.status(500).json({ success: false, message: err.message || 'Failed to create employee.' });
    }
  },

  // 5. Admin Update Employee
  updateEmployee: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { name, role, phone, department, password, startTime, endTime } = req.body;

    try {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        res.status(404).json({ success: false, message: 'Employee not found.' });
        return;
      }

      const updateData: any = {};
      if (name) updateData.name = name.trim();
      if (role && (Role as any)[role]) updateData.role = (Role as any)[role];
      if (phone !== undefined) updateData.phone = phone ? phone.trim() : null;
      if (department !== undefined) updateData.department = department ? department.trim() : null;
      if (password && password.trim().length > 0) {
        updateData.password = await bcrypt.hash(password.trim(), 10);
      }

      const updated = await prisma.user.update({
        where: { id },
        data: updateData,
      });

      // Update schedule timings if provided
      if (startTime || endTime) {
        await prisma.employeeSchedule.updateMany({
          where: { employeeId: id, isWorkingDay: true },
          data: {
            ...(startTime ? { startTime } : {}),
            ...(endTime ? { endTime } : {}),
          },
        });
      }

      res.json({
        success: true,
        message: `Employee '${updated.name}' updated successfully.`,
        data: updated,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to update employee.' });
    }
  },

  // 6. Admin Toggle Employee Active / Deactivated Status
  toggleEmployeeStatus: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;

    try {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        res.status(404).json({ success: false, message: 'Employee not found.' });
        return;
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { isActive: !user.isActive },
      });

      res.json({
        success: true,
        message: `Employee '${updated.name}' is now ${updated.isActive ? 'ACTIVE' : 'INACTIVE'}.`,
        data: { id: updated.id, isActive: updated.isActive },
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to toggle employee status.' });
    }
  },
};
