import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';

interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  multi?: boolean;
  onAddNew?: (value: string) => void;
  exclusiveOption?: string; // e.g. "Unknown Problem" — selecting it clears the rest
}

/** Tag/chip selector used for Site and Problem, with an inline "+ Add New" modal. */
export const TagSelector: React.FC<Props> = ({ label, options, selected, onChange, multi, onAddNew, exclusiveOption }) => {
  const [addVisible, setAddVisible] = useState(false);
  const [newValue, setNewValue] = useState('');

  const toggle = (opt: string) => {
    if (!multi) return onChange([opt]);
    if (exclusiveOption && opt === exclusiveOption) return onChange(selected.includes(opt) ? [] : [opt]);
    const withoutExclusive = selected.filter((s) => s !== exclusiveOption);
    onChange(withoutExclusive.includes(opt) ? withoutExclusive.filter((s) => s !== opt) : [...withoutExclusive, opt]);
  };

  const submitNew = () => {
    const v = newValue.trim();
    if (!v) return;
    onAddNew?.(v);
    toggle(v);
    setNewValue('');
    setAddVisible(false);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <TouchableOpacity key={opt} style={[styles.chip, active && styles.chipActive]} onPress={() => toggle(opt)}>
              <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
        {onAddNew && (
          <TouchableOpacity style={styles.addChip} onPress={() => setAddVisible(true)}>
            <Text style={styles.addChipText}>+ Add New</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={addVisible} transparent animationType="fade" onRequestClose={() => setAddVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New {label}</Text>
            <TextInput
              value={newValue}
              onChangeText={setNewValue}
              placeholder={`Enter ${label.toLowerCase()}`}
              style={styles.input}
              autoFocus
              maxLength={60}
            />
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setAddVisible(false); setNewValue(''); }}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAdd} onPress={submitNew}>
                <Text style={styles.modalAddText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', maxWidth: 200 },
  chipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  chipText: { fontSize: 13, color: '#334155', fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },
  addChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1, borderColor: '#10B981', borderStyle: 'dashed' },
  addChipText: { fontSize: 13, color: '#10B981', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 14 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#0F172A' },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 10 },
  modalCancel: { paddingHorizontal: 16, paddingVertical: 10 },
  modalCancelText: { color: '#64748B', fontWeight: '700', fontSize: 14 },
  modalAdd: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#10B981', borderRadius: 12 },
  modalAddText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
});
