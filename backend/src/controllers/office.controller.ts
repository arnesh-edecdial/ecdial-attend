import { Response } from 'express';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';

const DEFAULT_OFFICE_SLOTS = [
  {
    slotIndex: 1,
    officeName: 'ECDIAL Tiruppur',
    address: 'Avinashi Road, Tiruppur, Tamil Nadu',
    latitude: 11.1085,
    longitude: 77.3411,
    allowedRadiusMeters: 200.0,
    qrRotationSeconds: 30,
    isDefault: true,
  },
  {
    slotIndex: 2,
    officeName: 'ECDIAL Coimbatore',
    address: 'Avinashi Road, Peelamedu, Coimbatore, Tamil Nadu',
    latitude: 11.0168,
    longitude: 76.9558,
    allowedRadiusMeters: 200.0,
    qrRotationSeconds: 30,
    isDefault: false,
  },
  {
    slotIndex: 3,
    officeName: 'ECDIAL Chennai',
    address: 'Anna Salai, Guindy, Chennai, Tamil Nadu',
    latitude: 13.0827,
    longitude: 80.2707,
    allowedRadiusMeters: 200.0,
    qrRotationSeconds: 30,
    isDefault: false,
  },
];

async function ensureThreeOffices() {
  const existing = await prisma.officeConfig.findMany({
    orderBy: { slotIndex: 'asc' },
  });

  if (existing.length >= 3) {
    return existing.slice(0, 3);
  }

  // Populate/reconcile missing slots up to 3
  const existingSlotIndices = new Set(existing.map((e) => e.slotIndex || 1));
  for (const defSlot of DEFAULT_OFFICE_SLOTS) {
    if (!existingSlotIndices.has(defSlot.slotIndex) && existing.length < 3) {
      const created = await prisma.officeConfig.create({
        data: defSlot,
      });
      existing.push(created);
      existingSlotIndices.add(defSlot.slotIndex);
    }
  }

  return prisma.officeConfig.findMany({
    orderBy: { slotIndex: 'asc' },
  });
}

export const officeController = {
  /**
   * 1. Get List of all 3 Configured Office Locations
   */
  listOffices: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const offices = await ensureThreeOffices();
      res.json({
        success: true,
        data: offices,
      });
    } catch (err: any) {
      console.error('[List Offices Error]', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve office locations.' });
    }
  },

  /**
   * 2. Update a Specific Office Slot (Admin Only)
   */
  updateOfficeSlot: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { officeName, address, latitude, longitude, allowedRadiusMeters, qrRotationSeconds, isDefault, slotIndex } = req.body;

    try {
      const existing = await prisma.officeConfig.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ success: false, message: 'Office location not found.' });
        return;
      }

      const updated = await prisma.officeConfig.update({
        where: { id },
        data: {
          officeName: officeName !== undefined ? String(officeName).trim() : existing.officeName,
          address: address !== undefined ? (address ? String(address).trim() : null) : existing.address,
          latitude: latitude !== undefined ? Number(latitude) : existing.latitude,
          longitude: longitude !== undefined ? Number(longitude) : existing.longitude,
          allowedRadiusMeters: allowedRadiusMeters !== undefined ? Number(allowedRadiusMeters) : existing.allowedRadiusMeters,
          qrRotationSeconds: qrRotationSeconds !== undefined ? Number(qrRotationSeconds) : existing.qrRotationSeconds,
          isDefault: isDefault !== undefined ? Boolean(isDefault) : existing.isDefault,
          slotIndex: slotIndex !== undefined ? Number(slotIndex) : existing.slotIndex,
        },
      });

      // Audit log
      await prisma.attendanceAuditLog.create({
        data: {
          employeeId: req.user?.id,
          employeeName: req.user?.name || 'Admin',
          action: 'OFFICE_CONFIG_UPDATED',
          date: new Date().toISOString().substring(0, 10),
          method: 'ADMIN_CONFIG',
          performedById: req.user?.id,
          details: JSON.stringify({
            updatedOfficeId: id,
            name: updated.officeName,
            lat: updated.latitude,
            lon: updated.longitude,
            radius: updated.allowedRadiusMeters,
          }),
        },
      });

      res.json({
        success: true,
        message: `Office '${updated.officeName}' updated successfully.`,
        data: updated,
      });
    } catch (err: any) {
      console.error('[Update Office Slot Error]', err);
      res.status(500).json({ success: false, message: 'Failed to update office location.' });
    }
  },

  /**
   * 3. Backward Compatibility: Get Default Single Office Config
   */
  getConfig: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const offices = await ensureThreeOffices();
      const defaultOffice = offices.find((o) => o.isDefault) || offices[0];
      res.json({
        success: true,
        data: defaultOffice,
      });
    } catch (err: any) {
      console.error('[Get Office Config Error]', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve office config.' });
    }
  },

  /**
   * 4. Backward Compatibility: Update Default Office Config
   */
  updateConfig: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { officeName, address, latitude, longitude, allowedRadiusMeters, qrRotationSeconds } = req.body;

    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({ success: false, message: 'Latitude and Longitude are required.' });
      return;
    }

    try {
      const offices = await ensureThreeOffices();
      const target = offices.find((o) => o.isDefault) || offices[0];

      const updated = await prisma.officeConfig.update({
        where: { id: target.id },
        data: {
          officeName: officeName || target.officeName,
          address: address !== undefined ? address : target.address,
          latitude: Number(latitude),
          longitude: Number(longitude),
          allowedRadiusMeters: Number(allowedRadiusMeters) || target.allowedRadiusMeters,
          qrRotationSeconds: Number(qrRotationSeconds) || target.qrRotationSeconds,
        },
      });

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
        message: 'Office location configuration updated successfully.',
        data: updated,
      });
    } catch (err: any) {
      console.error('[Update Config Error]', err);
      res.status(500).json({ success: false, message: 'Failed to update office config.' });
    }
  },
};
