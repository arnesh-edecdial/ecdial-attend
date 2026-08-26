import { Response } from 'express';
import { inMemoryDB } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';

export const scheduleController = {
  getEmployeeSchedule: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const employeeId = (req.params.employeeId as string) || (req.query.employeeId as string) || req.user?.id;
    if (!employeeId) {
      res.status(400).json({ success: false, message: 'Employee ID is required.' });
      return;
    }

    const employee = inMemoryDB.users.find((u) => u.id === employeeId);
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    let schedules = inMemoryDB.schedules.filter((s) => s.employeeId === employeeId);

    // If no schedule configured yet, generate default Mon-Sat 09:00-20:00, Sun OFF
    if (schedules.length === 0) {
      for (let day = 0; day <= 6; day++) {
        const newSched = {
          id: `sch-${employee.id}-${day}`,
          employeeId: employee.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '20:00',
          isWorkingDay: day !== 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        inMemoryDB.schedules.push(newSched);
      }
      schedules = inMemoryDB.schedules.filter((s) => s.employeeId === employeeId);
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const formatted = schedules
      .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
      .map((s) => ({
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
  },

  updateEmployeeSchedule: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const employeeId = req.params.employeeId as string;
    const { schedules } = req.body; // Array of { dayOfWeek, startTime, endTime, isWorkingDay }

    if (!Array.isArray(schedules)) {
      res.status(400).json({ success: false, message: 'Schedules must be an array.' });
      return;
    }

    const employee = inMemoryDB.users.find((u) => u.id === employeeId);
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    for (const item of schedules) {
      const existingIndex = inMemoryDB.schedules.findIndex(
        (s) => s.employeeId === employeeId && s.dayOfWeek === item.dayOfWeek
      );

      if (existingIndex >= 0) {
        inMemoryDB.schedules[existingIndex] = {
          ...inMemoryDB.schedules[existingIndex],
          startTime: item.startTime || '09:00',
          endTime: item.endTime || '20:00',
          isWorkingDay: item.isWorkingDay !== undefined ? item.isWorkingDay : true,
          updatedAt: new Date(),
        };
      } else {
        inMemoryDB.schedules.push({
          id: `sch-${employeeId}-${item.dayOfWeek}`,
          employeeId,
          dayOfWeek: item.dayOfWeek,
          startTime: item.startTime || '09:00',
          endTime: item.endTime || '20:00',
          isWorkingDay: item.isWorkingDay !== undefined ? item.isWorkingDay : true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Audit log
    inMemoryDB.auditLogs.push({
      id: `aud-${Date.now()}`,
      employeeId,
      employeeName: employee.name,
      action: 'SCHEDULE_UPDATED',
      date: new Date().toISOString().substring(0, 10),
      timestamp: new Date(),
      method: 'ADMIN_CONFIG',
      performedById: req.user?.id,
      details: JSON.stringify(schedules),
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: `Schedule updated successfully for ${employee.name}.`,
    });
  },
};
