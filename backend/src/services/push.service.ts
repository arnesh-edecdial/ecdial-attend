import { prisma } from '../db/store';

export interface PushNotificationPayload {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
  badge?: number;
  subtitle?: string;
}

export interface PushReceiptTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded' | string };
}

/**
 * Validates whether a token string is a valid Expo Push Token format.
 */
export function isExpoPushToken(token: string): boolean {
  return typeof token === 'string' && /^(ExponentPushToken|ExpoPushToken)\[.*\]$/.test(token.trim());
}

/**
 * Sends push notifications using the official Expo Push Notification HTTP/2 API.
 * Supports token batching, response validation, and automatic deactivation of dead/unregistered tokens.
 */
export async function sendExpoPushNotifications(messages: PushNotificationPayload[]): Promise<PushReceiptTicket[]> {
  if (!messages || messages.length === 0) return [];

  // Filter out any messages without valid recipients
  const validMessages: any[] = [];
  const tokenToUserMap = new Map<string, string>(); // token -> recipient

  for (const msg of messages) {
    const recipients = Array.isArray(msg.to) ? msg.to : [msg.to];
    for (const token of recipients) {
      if (token && isExpoPushToken(token)) {
        validMessages.push({
          to: token.trim(),
          title: msg.title,
          body: msg.body,
          data: msg.data || {},
          sound: msg.sound !== null ? 'default' : undefined,
          priority: msg.priority || 'high',
          channelId: msg.channelId || 'attendance_alerts',
          badge: msg.badge,
          subtitle: msg.subtitle,
          _displayInForeground: true,
        });
      }
    }
  }

  if (validMessages.length === 0) {
    return [];
  }

  const results: PushReceiptTicket[] = [];
  const CHUNK_SIZE = 100;

  for (let i = 0; i < validMessages.length; i += CHUNK_SIZE) {
    const chunk = validMessages.slice(i, i + CHUNK_SIZE);
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        console.error(`[Push API HTTP Error] ${response.status} ${response.statusText}`);
        continue;
      }

      const resData = (await response.json()) as { data?: PushReceiptTicket[]; errors?: any[] };
      if (resData && Array.isArray(resData.data)) {
        for (let j = 0; j < resData.data.length; j++) {
          const ticket = resData.data[j];
          results.push(ticket);

          // If the device token is expired or app was uninstalled, deactivate the token
          if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
            const invalidToken = chunk[j]?.to;
            if (invalidToken) {
              console.warn(`[Push Service] Deactivating unregistered token: ${invalidToken}`);
              prisma.devicePushToken
                .updateMany({
                  where: { token: invalidToken },
                  data: { isActive: false },
                })
                .catch((e) => console.error('[Push Token Deactivation Error]', e));
            }
          }
        }
      }
    } catch (err: any) {
      console.error('[Push Send Error]', err.message || err);
    }
  }

  return results;
}
