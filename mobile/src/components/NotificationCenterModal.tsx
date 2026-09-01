import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileApi } from '../services/api';

export interface InAppNotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  entityId?: string | null;
  entityType?: string | null;
  targetScreen?: string | null;
  metadata?: string | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationCenterModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToScreen: (targetScreen: string, entityId?: string | null, metadata?: any) => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  visible,
  onClose,
  onNavigateToScreen,
  onUnreadCountChange,
}) => {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<InAppNotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await mobileApi.listNotifications();
      if (res && res.success && res.data) {
        const notifs = res.data.notifications || [];
        const unread = res.data.unreadCount || 0;
        setNotifications(notifs);
        setUnreadCount(unread);
        if (onUnreadCountChange) onUnreadCountChange(unread);
      }
    } catch (err) {
      console.warn('[Fetch Notifications Error]', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      fetchNotifications();
    }
  }, [visible]);

  const handleNotificationPress = async (item: InAppNotificationItem) => {
    // 1. Optimistic Mark as Read
    if (!item.isRead) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      if (onUnreadCountChange) onUnreadCountChange(Math.max(0, unreadCount - 1));
      mobileApi.markNotificationAsRead(item.id).catch((e) => console.warn(e));
    }

    // 2. Parse metadata if any
    let parsedMeta: any = {};
    if (item.metadata) {
      try {
        parsedMeta = typeof item.metadata === 'string' ? JSON.parse(item.metadata) : item.metadata;
      } catch {}
    }

    // 3. Close modal & Navigate to exact screen
    onClose();
    if (item.targetScreen) {
      onNavigateToScreen(item.targetScreen, item.entityId, parsedMeta);
    }
  };

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true);
    try {
      await mobileApi.markAllNotificationsAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      if (onUnreadCountChange) onUnreadCountChange(0);
    } catch (err) {
      console.warn('[Mark All Read Error]', err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    if (type.includes('ATTENDANCE_REQUEST') || type.includes('REQUEST')) return '📝';
    if (type.includes('TIME_EDITED') || type.includes('CLOCK')) return '⏰';
    if (type.includes('CLOSING')) return '🔒';
    if (type.includes('QUOTATION')) return '📄';
    if (type.includes('STOCK')) return '📦';
    if (type.includes('CUSTOMER')) return '👥';
    if (type.includes('HOLIDAY')) return '🎉';
    return '🔔';
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 2) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount} new</Text>
                </View>
              )}
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={handleMarkAllRead} disabled={isMarkingAll}>
                  <Text style={styles.markAllText}>{isMarkingAll ? '...' : 'Mark all read'}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* List */}
          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={fetchNotifications} tintColor="#0066CC" />}
          >
            {notifications.length === 0 && !isLoading ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🔔</Text>
                <Text style={styles.emptyTitle}>All caught up!</Text>
                <Text style={styles.emptySubtitle}>No new notifications right now.</Text>
              </View>
            ) : (
              notifications.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.notifCard, !item.isRead && styles.unreadCard]}
                  onPress={() => handleNotificationPress(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.iconContainer}>
                    <Text style={{ fontSize: 18 }}>{getNotificationIcon(item.type)}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <Text style={[styles.notifTitle, !item.isRead && styles.unreadTitle]}>{item.title}</Text>
                      <Text style={styles.timeText}>{formatTimestamp(item.createdAt)}</Text>
                    </View>
                    <Text style={styles.notifMessage} numberOfLines={3}>
                      {item.message}
                    </Text>
                  </View>

                  {!item.isRead && <View style={styles.unreadDot} />}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    minHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  badge: {
    backgroundColor: '#0066CC',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  markAllText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '700',
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  unreadCard: {
    backgroundColor: '#162238',
    borderColor: '#0284C7',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifTitle: {
    color: '#E2E8F0',
    fontSize: 13.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  unreadTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  notifMessage: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
  },
  timeText: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '600',
    marginLeft: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#38BDF8',
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  emptySubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },
});
