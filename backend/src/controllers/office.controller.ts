import { Response } from 'express';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';

export const officeController = {
  getConfig: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const config = (await prisma.officeConfig.findFirst({ where: { isDefault: true } })) ||
        (await prisma.officeConfig.findFirst());
      res.json({
        success: true,
        data: config,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to retrieve office config.' });
    }
  },

  updateConfig: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { officeName, latitude, longitude, allowedRadiusMeters, qrRotationSeconds } = req.body;

    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({ success: false, message: 'Latitude and Longitude are required.' });
      return;
    }

    try {
      const radius = Number(allowedRadiusMeters) || 100.0;
      const rotation = Number(qrRotationSeconds) || 30;

      const existing = await prisma.officeConfig.findFirst({ where: { isDefault: true } });

      let updated;
      if (existing) {
        updated = await prisma.officeConfig.update({
          where: { id: existing.id },
          data: {
            officeName: officeName || existing.officeName,
            latitude: Number(latitude),
            longitude: Number(longitude),
            allowedRadiusMeters: radius,
            qrRotationSeconds: rotation,
          },
        });
      } else {
        updated = await prisma.officeConfig.create({
          data: {
            officeName: officeName || 'ECDIAL Headquarters',
            latitude: Number(latitude),
            longitude: Number(longitude),
            allowedRadiusMeters: radius,
            qrRotationSeconds: rotation,
            isDefault: true,
          },
        });
      }

      // Audit log
      await prisma.attendanceAuditLog.create({
        data: {
          employeeId: req.user?.id,
          employeeName: req.user?.name || 'Admin',
          action: 'OFFICE_CONFIG_UPDATED',
          date: new Date().toISOString().substring(0, 10),
          method: 'ADMIN_CONFIG',
          performedById: req.user?.id,
          details: JSON.stringify(updated),
        },
      });

      res.json({
        success: true,
        message: 'Office location and radius configuration updated successfully.',
        data: updated,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to update office config.' });
    }
  },
};
