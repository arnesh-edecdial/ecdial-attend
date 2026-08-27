import { Response } from 'express';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';

export const auditController = {
  listAuditLogs: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const employeeId = req.query.employeeId as string;
    const action = req.query.action as string;
    const date = req.query.date as string;

    try {
      const logs = await prisma.attendanceAuditLog.findMany({
        where: {
          ...(employeeId ? { employeeId } : {}),
          ...(action ? { action } : {}),
          ...(date ? { date } : {}),
        },
        orderBy: { timestamp: 'desc' },
        take: 100,
      });

      res.json({
        success: true,
        data: {
          total: logs.length,
          logs,
        },
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to retrieve audit logs.' });
    }
  },
};
