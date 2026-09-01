import { Response } from 'express';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';

export const notificationController = {
  // 1. List Notifications for Current User with Unread Count
  listNotifications: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    try {
      const [notifications, unreadCount] = await Promise.all([
        prisma.appNotification.findMany({
          where: { userId: req.user.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        prisma.appNotification.count({
          where: { userId: req.user.id, isRead: false },
        }),
      ]);

      res.json({
        success: true,
        data: {
          notifications,
          unreadCount,
        },
      });
    } catch (err: any) {
      console.error('[List Notifications Error]', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve notifications.' });
    }
  },

  // 2. Mark Single Notification as Read
  markAsRead: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    try {
      await prisma.appNotification.updateMany({
        where: { id, userId: req.user.id },
        data: { isRead: true },
      });

      res.json({ success: true, message: 'Notification marked as read.' });
    } catch (err: any) {
      console.error('[Mark Read Error]', err);
      res.status(500).json({ success: false, message: 'Failed to update notification.' });
    }
  },

  // 3. Mark All Notifications as Read
  markAllAsRead: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    try {
      await prisma.appNotification.updateMany({
        where: { userId: req.user.id, isRead: false },
        data: { isRead: true },
      });

      res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (err: any) {
      console.error('[Mark All Read Error]', err);
      res.status(500).json({ success: false, message: 'Failed to mark all as read.' });
    }
  },

  // 4. Register / Update Device Push Token
  registerDevice: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { token, platform, deviceId, deviceModel } = req.body;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ success: false, message: 'Push token is required.' });
      return;
    }

    try {
      const cleanToken = token.trim();
      const cleanPlatform = (platform || 'android').toLowerCase();

      const record = await prisma.devicePushToken.upsert({
        where: {
          userId_token: {
            userId: req.user.id,
            token: cleanToken,
          },
        },
        update: {
          platform: cleanPlatform,
          deviceId: deviceId || null,
          deviceModel: deviceModel || null,
          isActive: true,
          updatedAt: new Date(),
        },
        create: {
          userId: req.user.id,
          token: cleanToken,
          platform: cleanPlatform,
          deviceId: deviceId || null,
          deviceModel: deviceModel || null,
          isActive: true,
        },
      });

      res.json({
        success: true,
        message: 'Device push token registered successfully.',
        data: { id: record.id, active: record.isActive },
      });
    } catch (err: any) {
      console.error('[Register Device Error]', err);
      res.status(500).json({ success: false, message: 'Failed to register device token.' });
    }
  },

  // 5. Unregister Device Push Token (On Logout)
  unregisterDevice: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { token } = req.body;
    try {
      if (token) {
        await prisma.devicePushToken.updateMany({
          where: {
            userId: req.user.id,
            token: token.trim(),
          },
          data: { isActive: false },
        });
      } else {
        // Deactivate all tokens for this user if no specific token provided
        await prisma.devicePushToken.updateMany({
          where: { userId: req.user.id },
          data: { isActive: false },
        });
      }

      res.json({ success: true, message: 'Device push token unregistered successfully.' });
    } catch (err: any) {
      console.error('[Unregister Device Error]', err);
      res.status(500).json({ success: false, message: 'Failed to unregister device token.' });
    }
  },
};
