import { Response } from 'express';
import { inMemoryDB } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';

export const auditController = {
  listAuditLogs: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const employeeId = req.query.employeeId as string;
    const action = req.query.action as string;
    const date = req.query.date as string;

    let logs = [...inMemoryDB.auditLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    if (employeeId) {
      logs = logs.filter((l) => l.employeeId === employeeId);
    }
    if (action) {
      logs = logs.filter((l) => l.action === action);
    }
    if (date) {
      logs = logs.filter((l) => l.date === date);
    }

    res.json({
      success: true,
      data: {
        total: logs.length,
        logs: logs.slice(0, 100), // Return last 100 logs
      },
    });
  },
};
