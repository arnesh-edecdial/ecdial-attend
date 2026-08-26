import { Response } from 'express';
import { inMemoryDB } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';

export const officeController = {
  getConfig: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({
      success: true,
      data: inMemoryDB.officeConfig,
    });
  },

  updateConfig: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { officeName, latitude, longitude, allowedRadiusMeters, qrRotationSeconds } = req.body;

    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({ success: false, message: 'Latitude and Longitude are required.' });
      return;
    }

    const radius = Number(allowedRadiusMeters) || 100.0;
    const rotation = Number(qrRotationSeconds) || 30;

    inMemoryDB.officeConfig = {
      ...inMemoryDB.officeConfig,
      officeName: officeName || inMemoryDB.officeConfig.officeName,
      latitude: Number(latitude),
      longitude: Number(longitude),
      allowedRadiusMeters: radius,
      qrRotationSeconds: rotation,
      updatedAt: new Date(),
    };

    // Audit log
    inMemoryDB.auditLogs.push({
      id: `aud-${Date.now()}`,
      employeeId: req.user?.id,
      employeeName: req.user?.name || 'Admin',
      action: 'OFFICE_CONFIG_UPDATED',
      date: new Date().toISOString().substring(0, 10),
      timestamp: new Date(),
      method: 'ADMIN_CONFIG',
      performedById: req.user?.id,
      details: JSON.stringify(inMemoryDB.officeConfig),
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Office location and radius configuration updated successfully.',
      data: inMemoryDB.officeConfig,
    });
  },
};
