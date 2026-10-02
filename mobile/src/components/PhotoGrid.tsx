import React from 'react';
import { View, Image, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getAuthToken } from '../services/api';

export interface PhotoItem {
  id: string;
  uri: string;
  uploading?: boolean;
}

interface Props {
  photos: PhotoItem[];
  onAdd: (uris: string[]) => void;
  onRemove?: (id: string) => void;
  onPreview?: (photo: PhotoItem, index: number) => void;
  disabled?: boolean;
}

async function ensureCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.getCameraPermissionsAsync();
  if (status === 'granted') return true;
  const req = await ImagePicker.requestCameraPermissionsAsync();
  return req.status === 'granted';
}

export const PhotoGrid: React.FC<Props> = ({ photos, onAdd, onRemove, onPreview, disabled }) => {
  const takePhoto = async () => {
    if (!(await ensureCameraPermission())) return;
    const result = await ImagePicker.launchCameraAsync({ quality: 0.6, allowsEditing: false });
    if (!result.canceled) onAdd(result.assets.map((a) => a.uri));
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.6,
      allowsMultipleSelection: true,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!result.canceled) onAdd(result.assets.map((a) => a.uri));
  };

  const authHeaders = getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : undefined;

  return (
    <View>
      <View style={styles.grid}>
        {photos.map((p, index) => (
          <View key={p.id} style={styles.thumbWrap}>
            <TouchableOpacity
              activeOpacity={0.82}
              style={styles.thumbButton}
              disabled={!onPreview || !!p.uploading}
              onPress={() => onPreview?.(p, index)}
            >
              <Image
                source={{ uri: p.uri, headers: authHeaders }}
                style={styles.thumb}
                resizeMode="cover"
              />
            </TouchableOpacity>
            {p.uploading && <ActivityIndicator style={StyleSheet.absoluteFill} color="#FFFFFF" />}
            {onRemove && !p.uploading && (
              <TouchableOpacity style={styles.removeBtn} onPress={() => onRemove(p.id)}>
                <Text style={styles.removeText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
      {!disabled && (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtn} onPress={takePhoto}>
            <Text style={styles.actionText}>📷 Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={pickFromGallery}>
            <Text style={styles.actionText}>🖼️ Choose Photos</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const THUMB = 84;
const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  thumbWrap: { width: THUMB, height: THUMB, borderRadius: 12, overflow: 'hidden', backgroundColor: '#E2E8F0' },
  thumbButton: { width: '100%', height: '100%' },
  thumb: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(15,23,42,0.75)', alignItems: 'center', justifyContent: 'center' },
  removeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#F8FAFC' },
  actionText: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
});
