import { Response } from 'express';
import { inMemoryDB } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';

export const holidayController = {
  listHolidays: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const list = [...inMemoryDB.holidays].sort((a, b) => a.date.localeCompare(b.date));
    res.json({ success: true, data: list });
  },

  createHoliday: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { date, name, description } = req.body;

    if (!date || !name) {
      res.status(400).json({ success: false, message: 'Date (YYYY-MM-DD) and holiday name are required.' });
      return;
    }

    const existing = inMemoryDB.holidays.find((h) => h.date === date);
    if (existing) {
      res.status(400).json({ success: false, message: `A holiday is already configured for ${date}.` });
      return;
    }

    const newHoliday = {
      id: `hol-${Date.now()}`,
      date,
      name,
      description: description || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    inMemoryDB.holidays.push(newHoliday);

    res.json({
      success: true,
      message: `Government holiday '${name}' configured for ${date}.`,
      data: newHoliday,
    });
  },

  deleteHoliday: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const id = req.params.id;
    const index = inMemoryDB.holidays.findIndex((h) => h.id === id || h.date === id);

    if (index === -1) {
      res.status(404).json({ success: false, message: 'Holiday not found.' });
      return;
    }

    const deleted = inMemoryDB.holidays.splice(index, 1)[0];
    res.json({
      success: true,
      message: `Holiday '${deleted.name}' removed.`,
    });
  },
};
