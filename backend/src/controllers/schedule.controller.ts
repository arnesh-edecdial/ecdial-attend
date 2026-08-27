import { Response } from 'express';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';

export const scheduleController = {
  getEmployeeSchedule: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const employeeId = (req.params.employeeId as string) || (req.query.employeeId as string) || req.user?.id;
    if (!employeeId) {
      res.status(400).json({ success: false, message: 'Employee ID is required.' });
      return;
    }

    try {
      const employee = await prisma.user.findUnique({
        where: { id: employeeId },
        include: {
          schedules: {
            orderBy: { dayOfWeek: 'asc' },
          },
        },
      });

      if (!employee) {
        res.status(404).json({ success: false, message: 'Employee not found.' });
        return;
      }

      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const formatted = employee.schedules.map((s) => ({
        ...s,
        dayName: dayNames[s.dayOfWeek],
      }));

      res.json({
        success: true,
        data: {
          employee: {
            id: employee.id,
            name: employee.name,
            employeeCode: employee.employeeCode,
            role: employee.role,
          },
          schedules: formatted,
        },
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to retrieve employee schedule.' });
    }
  },

  updateEmployeeSchedule: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const employeeId = req.params.employeeId as string;
    const { schedules } = req.body; // Array of { dayOfWeek, startTime, endTime, isWorkingDay }

    if (!Array.isArray(schedules)) {
      res.status(400).json({ success: false, message: 'Schedules must be an array.' });
      return;
    }

    try {
      const employee = await prisma.user.findUnique({ where: { id: employeeId } });
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employee not found.' });
        return;
      }

      for (const item of schedules) {
        await prisma.employeeSchedule.upsert({
          where: {
            employeeId_dayOfWeek: {
              employeeId,
              dayOfWeek: item.dayOfWeek,
            },
          },
          update: {
            startTime: item.startTime || '09:00',
            endTime: item.endTime || '18:00',
            isWorkingDay: item.isWorkingDay !== undefined ? item.isWorkingDay : true,
          },
          create: {
            employeeId,
            dayOfWeek: item.dayOfWeek,
            startTime: item.startTime || '09:00',
            endTime: item.endTime || '18:00',
            isWorkingDay: item.isWorkingDay !== undefined ? item.isWorkingDay : true,
          },
        });
      }

      // Audit log
      await prisma.attendanceAuditLog.create({
        data: {
          employeeId,
          employeeName: employee.name,
          action: 'SCHEDULE_UPDATED',
          date: new Date().toISOString().substring(0, 10),
          method: 'ADMIN_CONFIG',
          performedById: req.user?.id,
          details: JSON.stringify(schedules),
        },
      });

      res.json({
        success: true,
        message: `Schedule updated successfully for ${employee.name}.`,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to update schedule.' });
    }
  },
};
