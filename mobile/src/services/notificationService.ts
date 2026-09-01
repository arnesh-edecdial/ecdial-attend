import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { mobileApi } from './api';

// Configure Foreground Notification Presentation Handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface DeepLinkPayload {
  targetScreen?: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, any>;
  notificationId?: string;
}

type NotificationNavigationHandler = (payload: DeepLinkPayload) => void;

class NotificationService {
  private registeredToken: string | null = null;
  private navigationHandler: NotificationNavigationHandler | null = null;
  private pendingPayload: DeepLinkPayload | null = null;

  /**
   * Set the deep-link navigation callback from App.tsx
   */
  public setNavigationHandler(handler: NotificationNavigationHandler) {
    this.navigationHandler = handler;
    // If a notification was clicked while launching from a terminated state, trigger it now
    if (this.pendingPayload) {
      handler(this.pendingPayload);
      this.pendingPayload = null;
    }
  }

  /**
   * Configure Android Notification Channels for Professional Alerts
   */
  public async configureAndroidChannels(): Promise<void> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('attendance_alerts', {
        name: 'Attendance & Clock-In Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0066CC',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('admin_approvals', {
        name: 'Admin Approval Queue',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 200, 200],
        lightColor: '#EA580C',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });

      await Notifications.setNotificationChannelAsync('general_updates', {
        name: 'General Business Updates',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }
  }

  /**
   * Request permissions and register Expo Push Token with backend
   */
  public async registerForPushNotifications(): Promise<string | null> {
    try {
      await this.configureAndroidChannels();

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Push Notification] Permission not granted by user.');
        return null;
      }

      // Get Project ID from Constants
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ||
        Constants?.easConfig?.projectId ||
        '5063e54b-2c5c-4f3a-aebf-6402851b16ce';

      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      const token = tokenResponse.data;
      this.registeredToken = token;

      // Register with live ECDIAL backend
      await mobileApi.registerDeviceToken({
        token,
        platform: Platform.OS,
        deviceId: Constants.installationId || undefined,
        deviceModel: `${Platform.OS.toUpperCase()} Device`,
      });

      return token;
    } catch (err: any) {
      console.warn('[Push Notification Registration Warning]', err?.message || err);
      return null;
    }
  }

  /**
   * Unregister token on Logout
   */
  public async unregister(): Promise<void> {
    try {
      if (this.registeredToken) {
        await mobileApi.unregisterDeviceToken({ token: this.registeredToken });
        this.registeredToken = null;
      }
    } catch (err) {
      console.error('[Push Unregister Error]', err);
    }
  }

  /**
   * Initialize Notification Listeners (Received + Tapped/Clicked)
   */
  public setupNotificationListeners(): () => void {
    // 1. App killed/terminated launch listener
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification?.request?.content?.data) {
        const data = response.notification.request.content.data as DeepLinkPayload;
        if (this.navigationHandler) {
          this.navigationHandler(data);
        } else {
          this.pendingPayload = data;
        }
      }
    });

    // 2. Notification Response Listener (Background or Foreground Tap)
    const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response?.notification?.request?.content?.data as DeepLinkPayload | undefined;
      if (data) {
        if (this.navigationHandler) {
          this.navigationHandler(data);
        } else {
          this.pendingPayload = data;
        }
      }
    });

    return () => {
      responseListener.remove();
    };
  }

  /**
   * Send an immediate local notification (e.g. for completed file downloads)
   */
  public async sendLocalNotification(title: string, body: string, data?: Record<string, any>): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: data || {},
          sound: 'default',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null, // show immediately
      });
    } catch (e) {
      console.error('[Local Notification Error]', e);
    }
  }
}

export const notificationService = new NotificationService();
