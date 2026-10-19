import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PERF_ENABLED, clearPerf, getPerfEntries, perfSummary, subscribePerf } from './perf';

/** Drop <PerfPanel /> once at the bottom of App.tsx. A small ⏱ button opens the live report. */
export const PerfPanel: React.FC = () => {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => subscribePerf(() => tick((n) => n + 1)), []);
  if (!PERF_ENABLED) return null;

  const recent = getPerfEntries().slice(-40).reverse();
  return (
    <>
      <Pressable style={[s.fab, { bottom: insets.bottom + 96 }]} onPress={() => setOpen(true)}>
        <Text style={s.fabText}>⏱</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[s.wrap, { paddingTop: Math.max(insets.top, 12) }]}>
          <View style={s.bar}>
            <Text style={s.title}>Performance</Text>
            <Pressable onPress={() => Share.share({ message: perfSummary() })}><Text style={s.btn}>Share report</Text></Pressable>
            <Pressable onPress={clearPerf}><Text style={s.btn}>Clear</Text></Pressable>
            <Pressable onPress={() => setOpen(false)}><Text style={s.btn}>Close</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 60 }}>
            <Text style={s.mono}>{perfSummary()}</Text>
            <Text style={[s.mono, { marginTop: 18, fontWeight: '700' }]}>LATEST CALLS</Text>
            {recent.map((e, i) => (
              <Text key={i} style={[s.mono, { color: e.status >= 400 || e.status === 0 ? '#B91C1C' : e.ms > 1000 ? '#DC2626' : e.ms > 400 ? '#D97706' : '#15803D' }]}>
                {e.method} {e.path} {e.status} {e.ms}ms{e.serverMs != null ? ` (srv ${e.serverMs})` : ''}{e.cold ? ' COLD' : ''}{e.note ? ' ' + e.note : ''}
              </Text>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const s = StyleSheet.create({
  fab: { position: 'absolute', left: 8, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center' },
  fabText: { fontSize: 16 },
  wrap: { flex: 1, backgroundColor: '#fff' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 14, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#D1D5DB' },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827' },
  btn: { color: '#007AFF', fontSize: 15, fontWeight: '600' },
  mono: { fontFamily: 'monospace', fontSize: 11, lineHeight: 16, color: '#111827' },
});
