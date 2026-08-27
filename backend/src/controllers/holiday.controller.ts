import { Response } from 'express';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';

export const holidayController = {
  listHolidays: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const list = await prisma.governmentHoliday.findMany({
        orderBy: { date: 'asc' },
      });
      res.json({ success: true, data: list });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to list holidays.' });
    }
  },

  createHoliday: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { date, name, description } = req.body;

    if (!date || !name) {
      res.status(400).json({ success: false, message: 'Date (YYYY-MM-DD) and holiday name are required.' });
      return;
    }

    try {
      const existing = await prisma.governmentHoliday.findUnique({ where: { date } });
      if (existing) {
        res.status(400).json({ success: false, message: `A company leave / holiday is already configured for ${date}.` });
        return;
      }

      const newHoliday = await prisma.governmentHoliday.create({
        data: {
          date: date.trim(),
          name: name.trim(),
          description: description ? description.trim() : null,
        },
      });

      res.json({
        success: true,
        message: `Company leave '${name}' configured for ${date}.`,
        data: newHoliday,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to create holiday.' });
    }
  },

  deleteHoliday: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const idOrDate = req.params.id;

    try {
      const holiday = await prisma.governmentHoliday.findFirst({
        where: {
          OR: [{ id: idOrDate }, { date: idOrDate }],
        },
      });

      if (!holiday) {
        res.status(404).json({ success: false, message: 'Holiday not found.' });
        return;
      }

      await prisma.governmentHoliday.delete({ where: { id: holiday.id } });

      res.json({
        success: true,
        message: `Company leave '${holiday.name}' for ${holiday.date} removed.`,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to delete holiday.' });
    }
  },
};
