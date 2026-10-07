import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface TimelineEvent {
  id: string;
  itemId?: string | null;
  eventType: string;
  title: string;
  description?: string | null;
  performedByName: string;
  createdAt: string;
}

interface Props {
  events: TimelineEvent[];
}

/**
 * Renders any event regardless of eventType — including legacy event types
 * from records created before this rebuild (e.g. old "SENT_OUT"/"RETURNED"
 * values) — falling back to a generic dot/icon for anything not in ICONS.
 */
const ICONS: Record<string, string> = {
  INTAKE_CREATED: '🆕',
  ITEM_ADDED: '➕',
  ITEM_UPDATED: '✏️',
  PRODUCT_CHANGED: '🔧',
  SERIAL_CHANGED: '🔢',
  IMAGE_ADDED: '📷',
  IMAGE_REMOVED: '🗑️',
  STATUS_CHANGED: '🔄',
  SITE_CHANGED: '📍',
  PROBLEMS_CHANGED: '⚠️',
  TAKING_TO_CHANGED: '🚚',
  NOTES_CHANGED: '📝',
  CUSTOMER_CHANGED: '👤',
  RESPONSIBLE_CHANGED: '🧑‍🔧',
  NOTE_ADDED: '💬',
  ARCHIVED: '📦',
};
const DEFAULT_ICON = '•';

const formatDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
};

export const ServiceIntakeTimeline: React.FC<Props> = ({ events }) => {
  if (!events || events.length === 0) {
    return <Text style={styles.empty}>No history yet.</Text>;
  }

  const visibleEvents = events.filter((e) => !(
    e.eventType === 'STATUS_CHANGED' && e.title.startsWith('Overall summary:')
  ));

  if (visibleEvents.length === 0) return <Text style={styles.empty}>No history yet.</Text>;

  return (
    <View>
      {visibleEvents.map((e, idx) => (
        <View key={e.id} style={styles.row}>
          <View style={styles.railCol}>
            <View style={styles.dot}>
              <Text style={styles.dotIcon}>{ICONS[e.eventType] || DEFAULT_ICON}</Text>
            </View>
            {idx < visibleEvents.length - 1 && <View style={styles.rail} />}
          </View>
          <View style={styles.content}>
            <Text style={styles.title}>{e.title}</Text>
            {!!e.description && <Text style={styles.description}>{e.description}</Text>}
            <Text style={styles.meta}>{e.performedByName} · {formatDateTime(e.createdAt)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  empty: { fontSize: 13, color: '#94A3B8', paddingVertical: 8 },
  row: { flexDirection: 'row' },
  railCol: { alignItems: 'center', width: 28 },
  dot: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  dotIcon: { fontSize: 12 },
  rail: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginVertical: 2 },
  content: { flex: 1, paddingBottom: 16, paddingLeft: 10 },
  title: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  description: { fontSize: 12, color: '#475569', marginTop: 2 },
  meta: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
});
