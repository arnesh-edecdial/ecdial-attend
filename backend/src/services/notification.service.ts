import { prisma } from '../db/store';
import { sendExpoPushNotifications } from './push.service';

export interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type: string;
  entityId?: string;
  entityType?: 'ATTENDANCE_REQUEST' | 'QUOTATION' | 'ATTENDANCE' | 'STOCK' | 'CUSTOMER' | 'SYSTEM';
  targetScreen?: 'ADMIN_APPROVALS' | 'ATTENDANCE_REQUEST' | 'ATTENDANCE' | 'QUOTATION_PREVIEW' | 'STOCK' | 'CUSTOMERS';
  metadata?: Record<string, any>;
  channelId?: string;
}

export const notificationService = {
  /**
   * Core dispatcher: Writes in-app notification to DB and asynchronously sends push notifications
   * to all active devices registered to the user.
   */
  dispatchNotification: async (params: CreateNotificationParams): Promise<any> => {
    const { userId, title, message, type, entityId, entityType, targetScreen, metadata, channelId } = params;

    try {
      // 1. Save In-App Notification in Database
      const appNotif = await prisma.appNotification.create({
        data: {
          userId,
          title: title.trim(),
          message: message.trim(),
          type,
          entityId: entityId || null,
          entityType: entityType || null,
          targetScreen: targetScreen || null,
          metadata: metadata ? JSON.stringify(metadata) : null,
          isRead: false,
        },
      });

      // 2. Fetch Active Device Push Tokens for this user
      const deviceTokens = await prisma.devicePushToken.findMany({
        where: {
          userId,
          isActive: true,
        },
        select: { token: true },
      });

      if (deviceTokens.length > 0) {
        const tokens = deviceTokens.map((d) => d.token);
        // Dispatch Push Asynchronously — never block or throw
        sendExpoPushNotifications([
          {
            to: tokens,
            title,
            body: message,
            channelId: channelId || 'attendance_alerts',
            priority: 'high',
            data: {
              notificationId: appNotif.id,
              type,
              targetScreen: targetScreen || 'ATTENDANCE',
              entityId: entityId || null,
              entityType: entityType || null,
              metadata: metadata || {},
            },
          },
        ]).catch((pushErr) => {
          console.error(`[Push Dispatch Error for user ${userId}]`, pushErr);
        });
      }

      return appNotif;
    } catch (err: any) {
      console.error('[Notification Dispatch Error]', err);
      return null;
    }
  },

  /**
   * Helper: Dispatch to multiple users (e.g. all Admins)
   */
  dispatchToUsers: async (userIds: string[], params: Omit<CreateNotificationParams, 'userId'>) => {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    const promises = uniqueUserIds.map((userId) =>
      notificationService.dispatchNotification({
        userId,
        ...params,
      })
    );
    return Promise.allSettled(promises);
  },

  /**
   * When an Employee submits an Attendance Request: Notify all Admins / HRs
   */
  notifyAdminsOfAttendanceRequest: async (data: {
    employeeId: string;
    employeeName: string;
    requestId: string;
    dates: string[];
    requestType: string;
  }) => {
    try {
      const admins = await prisma.user.findMany({
        where: {
          role: { in: ['ADMIN', 'IT_ADMIN', 'HR', 'MANAGER'] },
          isActive: true,
          id: { not: data.employeeId }, // Don't notify self if admin
        },
        select: { id: true },
      });

      if (admins.length === 0) return;

      const dateStr = data.dates.length === 1 ? data.dates[0] : `${data.dates.length} days (${data.dates[0]} to ${data.dates[data.dates.length - 1]})`;
      const title = 'New attendance request';
      const body = `${data.employeeName} has submitted an attendance request for ${dateStr}. Review required.`;

      await notificationService.dispatchToUsers(
        admins.map((a) => a.id),
        {
          title,
          message: body,
          type: 'ATTENDANCE_REQUEST_CREATED',
          entityId: data.requestId,
          entityType: 'ATTENDANCE_REQUEST',
          targetScreen: 'ADMIN_APPROVALS',
          metadata: {
            requestId: data.requestId,
            employeeId: data.employeeId,
            employeeName: data.employeeName,
            dates: data.dates,
            requestType: data.requestType,
          },
          channelId: 'admin_approvals',
        }
      );
    } catch (err) {
      console.error('[Notify Admins Error]', err);
    }
  },

  /**
   * When Admin approves or edits an Attendance Request: Notify the Employee
   */
  notifyEmployeeOfRequestDecision: async (data: {
    employeeId: string;
    requestId: string;
    date: string;
    isApproved: boolean;
    isEdited: boolean;
    inTime?: string;
    outTime?: string | null;
    reviewerName?: string;
  }) => {
    try {
      let title = 'Attendance request accepted';
      let body = `Your attendance request for ${data.date} was accepted.`;

      if (!data.isApproved) {
        title = 'Attendance request rejected';
        body = `Your attendance request for ${data.date} was rejected.`;
      } else if (data.isEdited) {
        title = 'Attendance time updated';
        const timeRange = data.outTime ? `${data.inTime || '09:00'} – ${data.outTime}` : `${data.inTime || '09:00'}`;
        body = `Your attendance for ${data.date} was updated to ${timeRange}.`;
      }

      await notificationService.dispatchNotification({
        userId: data.employeeId,
        title,
        message: body,
        type: data.isEdited ? 'ATTENDANCE_TIME_EDITED' : data.isApproved ? 'ATTENDANCE_REQUEST_ACCEPTED' : 'ATTENDANCE_REQUEST_REJECTED',
        entityId: data.requestId,
        entityType: 'ATTENDANCE_REQUEST',
        targetScreen: 'ATTENDANCE_REQUEST',
        metadata: {
          requestId: data.requestId,
          date: data.date,
          inTime: data.inTime,
          outTime: data.outTime,
        },
        channelId: 'attendance_alerts',
      });
    } catch (err) {
      console.error('[Notify Employee Decision Error]', err);
    }
  },

  /**
   * When employee needs closing time input before marking attendance
   */
  notifyAttendanceClosingRequired: async (data: { employeeId: string; date: string }) => {
    try {
      await notificationService.dispatchNotification({
        userId: data.employeeId,
        title: 'Attendance closing required',
        message: `Please enter your closing time for ${data.date} before marking today's attendance.`,
        type: 'ATTENDANCE_CLOSING_REQUIRED',
        entityType: 'ATTENDANCE',
        targetScreen: 'ATTENDANCE_REQUEST',
        metadata: { date: data.date, mode: 'CLOSING' },
        channelId: 'attendance_alerts',
      });
    } catch (err) {
      console.error('[Notify Closing Error]', err);
    }
  },

  /**
   * Quotation Created / Updated
   */
  notifyQuotationCreated: async (data: { userId: string; quotationId: string; quotationNumber: string; customerName?: string }) => {
    try {
      await notificationService.dispatchNotification({
        userId: data.userId,
        title: 'Quotation created',
        message: `Quotation #${data.quotationNumber} for ${data.customerName || 'Customer'} is ready.`,
        type: 'QUOTATION_CREATED',
        entityId: data.quotationId,
        entityType: 'QUOTATION',
        targetScreen: 'QUOTATION_PREVIEW',
        metadata: { quotationId: data.quotationId, quotationNumber: data.quotationNumber },
        channelId: 'general_updates',
      });
    } catch (err) {
      console.error('[Notify Quotation Error]', err);
    }
  },
};
