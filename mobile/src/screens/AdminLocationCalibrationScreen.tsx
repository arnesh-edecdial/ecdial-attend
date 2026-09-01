import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Rect, Path, G } from 'react-native-svg';
import * as Location from 'expo-location';
import { mobileApi } from '../services/api';

interface AdminLocationCalibrationScreenProps {
  onClose: () => void;
  onSaved?: () => void;
}

export const AdminLocationCalibrationScreen: React.FC<AdminLocationCalibrationScreenProps> = ({
  onClose,
  onSaved,
}) => {
  const [officeName, setOfficeName] = useState<string>('ECDIAL Headquarters');
  const [latitude, setLatitude] = useState<string>('11.0168');
  const [longitude, setLongitude] = useState<string>('76.9558');
  const [radiusMeters, setRadiusMeters] = useState<number>(200);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isFetchingGps, setIsFetchingGps] = useState<boolean>(false);

  // Admin device live distance preview
  const [adminCoords, setAdminCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [liveDistance, setLiveDistance] = useState<number | null>(null);

  // Calculate distance helper
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  };

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const res = await mobileApi.getOfficeConfig();
      if (res && res.success && res.data) {
        setOfficeName(res.data.officeName || 'ECDIAL Headquarters');
        setLatitude(String(res.data.latitude || 11.0168));
        setLongitude(String(res.data.longitude || 76.9558));
        setRadiusMeters(Number(res.data.allowedRadiusMeters) || 200);
      }

      // Fetch admin device current location for live distance test
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const currentLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (currentLoc && currentLoc.coords) {
          setAdminCoords({
            lat: currentLoc.coords.latitude,
            lon: currentLoc.coords.longitude,
          });

          const officeLat = Number(res?.data?.latitude || 11.0168);
          const officeLon = Number(res?.data?.longitude || 76.9558);
          const dist = calculateDistance(
            currentLoc.coords.latitude,
            currentLoc.coords.longitude,
            officeLat,
            officeLon
          );
          setLiveDistance(dist);
        }
      }
    } catch (err: any) {
      console.error('[Load Office Config Error]', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // Update live distance when inputs change
  useEffect(() => {
    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);
    if (adminCoords && !isNaN(latNum) && !isNaN(lonNum)) {
      const dist = calculateDistance(adminCoords.lat, adminCoords.lon, latNum, lonNum);
      setLiveDistance(dist);
    }
  }, [latitude, longitude, adminCoords]);

  const handleUseCurrentLocation = async () => {
    try {
      setIsFetchingGps(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to calibrate GPS coordinates.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      if (loc && loc.coords) {
        setLatitude(loc.coords.latitude.toFixed(6));
        setLongitude(loc.coords.longitude.toFixed(6));
        setAdminCoords({
          lat: loc.coords.latitude,
          lon: loc.coords.longitude,
        });
        setLiveDistance(0);
        Alert.alert('📍 Location Captured', `Coordinates set to your current device location:\nLat: ${loc.coords.latitude.toFixed(6)}, Lon: ${loc.coords.longitude.toFixed(6)}`);
      }
    } catch (err: any) {
      Alert.alert('GPS Error', err.message || 'Unable to capture current GPS location.');
    } finally {
      setIsFetchingGps(false);
    }
  };

  const handleSave = async () => {
    const latNum = parseFloat(latitude);
    const lonNum = parseFloat(longitude);

    if (isNaN(latNum) || isNaN(lonNum)) {
      Alert.alert('Invalid Coordinates', 'Please enter valid numeric latitude and longitude coordinates.');
      return;
    }

    if (!radiusMeters || radiusMeters < 10) {
      Alert.alert('Invalid Radius', 'Allowed perimeter radius must be at least 10 meters.');
      return;
    }

    try {
      setIsSaving(true);
      const res = await mobileApi.updateOfficeConfig({
        officeName: officeName.trim() || 'ECDIAL Headquarters',
        latitude: latNum,
        longitude: lonNum,
        allowedRadiusMeters: radiusMeters,
      });

      if (res && res.success) {
        Alert.alert('✓ Perimeter Calibrated', `Office geofence has been updated to ${radiusMeters}m around ${officeName}. Employees outside this area will be blocked from QR check-in.`);
        if (onSaved) onSaved();
        onClose();
      }
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Unable to update office configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const RADIUS_PRESETS = [50, 100, 200, 500, 1000, 2000];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Location Calibration</Text>
          <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Office GPS coordinates & geofence perimeter</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: '#F1F5F9',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#64748B' }}>✕</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingText}>Loading office geofence data...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* 1. VISUAL GEOFENCE RADAR / MAP CARD */}
          <View style={styles.visualCard}>
            <View style={styles.visualHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>📍</Text>
                <Text style={styles.visualTitle}>GEOFENCE RADAR PREVIEW</Text>
              </View>
              <View style={styles.radiusPill}>
                <Text style={styles.radiusPillText}>{radiusMeters} METERS RADIUS</Text>
              </View>
            </View>

            {/* Stylized Vector Map & Pulse Geofence Circle (Matches Reference Image) */}
            <View style={styles.mapCanvas}>
              <Svg width="100%" height={210} viewBox="0 0 320 210">
                {/* Background Roads / Map Grids */}
                <Rect x="0" y="0" width="320" height="210" fill="#F1F5F9" />
                <Path d="M 0,40 Q 90,60 160,30 T 320,50" stroke="#E2E8F0" strokeWidth="12" fill="none" />
                <Path d="M 40,0 Q 60,110 30,210" stroke="#E2E8F0" strokeWidth="10" fill="none" />
                <Path d="M 160,0 L 160,210" stroke="#E2E8F0" strokeWidth="8" fill="none" />
                <Path d="M 0,160 Q 150,140 320,170" stroke="#E2E8F0" strokeWidth="12" fill="none" />
                <Path d="M 270,0 Q 250,100 290,210" stroke="#E2E8F0" strokeWidth="10" fill="none" />

                {/* Outer Geofence Halo Ring */}
                <Circle cx="160" cy="105" r="78" fill="rgba(16, 185, 129, 0.08)" stroke="#10B981" strokeWidth="1.5" strokeDasharray="4,4" />
                {/* Inner Geofence Zone */}
                <Circle cx="160" cy="105" r="54" fill="rgba(16, 185, 129, 0.20)" stroke="#10B981" strokeWidth="2.5" />
                {/* Inner Center Radar Ping */}
                <Circle cx="160" cy="105" r="18" fill="rgba(16, 185, 129, 0.35)" />

                {/* Center Pin Marker */}
                <G transform="translate(144, 75)">
                  {/* Pin Body */}
                  <Path
                    d="M 16 0 C 7.16 0 0 7.16 0 16 C 0 28 16 40 16 40 C 16 40 32 28 32 16 C 32 7.16 24.84 0 16 0 Z"
                    fill="#0A1E3F"
                  />
                  {/* Inner Pin Disc */}
                  <Circle cx="16" cy="15" r="10" fill="#FFFFFF" />
                  <Circle cx="16" cy="15" r="6" fill="#0066CC" />
                </G>

                {/* Live Distance Point (Admin Device) */}
                {liveDistance !== null && (
                  <G transform="translate(160, 105)">
                    <Circle
                      cx={Math.min(70, Math.max(-70, (liveDistance / (radiusMeters || 1)) * 40))}
                      cy={Math.min(60, Math.max(-60, (liveDistance / (radiusMeters || 1)) * 30))}
                      r="6"
                      fill={liveDistance <= radiusMeters ? '#10B981' : '#EF4444'}
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                    />
                  </G>
                )}
              </Svg>

              {/* Coordinates Badge */}
              <View style={styles.coordsOverlay}>
                <Text style={styles.coordsText}>
                  {parseFloat(latitude).toFixed(4)}° N, {parseFloat(longitude).toFixed(4)}° E
                </Text>
              </View>
            </View>

            {/* Live Distance Status Feedback */}
            {liveDistance !== null && (
              <View
                style={[
                  styles.distanceStatusBox,
                  { backgroundColor: liveDistance <= radiusMeters ? '#ECFDF5' : '#FEF2F2' },
                ]}
              >
                <Text style={{ fontSize: 16 }}>{liveDistance <= radiusMeters ? '✅' : '⚠️'}</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.distanceStatusTitle,
                      { color: liveDistance <= radiusMeters ? '#065F46' : '#991B1B' },
                    ]}
                  >
                    {liveDistance <= radiusMeters
                      ? `WITHIN PERIMETER (${liveDistance}m away)`
                      : `OUTSIDE PERIMETER (${liveDistance}m away)`}
                  </Text>
                  <Text style={styles.distanceStatusSub}>
                    {liveDistance <= radiusMeters
                      ? `Your device is inside the allowed ${radiusMeters}m office perimeter.`
                      : `Your device is ${liveDistance - radiusMeters}m beyond the allowed ${radiusMeters}m boundary.`}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* 2. GPS AUTO-CAPTURE BUTTON */}
          <TouchableOpacity
            style={styles.gpsCaptureButton}
            onPress={handleUseCurrentLocation}
            disabled={isFetchingGps}
            activeOpacity={0.85}
          >
            {isFetchingGps ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={{ fontSize: 18 }}>📍</Text>
                <Text style={styles.gpsCaptureText}>Fetch & Calibrate My Current GPS Location</Text>
              </>
            )}
          </TouchableOpacity>

          {/* 3. SETTINGS FORM */}
          <View style={styles.formCard}>
            <Text style={styles.formCardTitle}>OFFICE LOCATION DETAILS</Text>

            {/* Office Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Office / Workplace Name</Text>
              <TextInput
                style={styles.textInput}
                value={officeName}
                onChangeText={setOfficeName}
                placeholder="e.g. ECDIAL Headquarters"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Coordinates Row */}
            <View style={styles.rowTwo}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Latitude</Text>
                <TextInput
                  style={styles.textInput}
                  value={latitude}
                  onChangeText={setLatitude}
                  keyboardType="numeric"
                  placeholder="11.016842"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>Longitude</Text>
                <TextInput
                  style={styles.textInput}
                  value={longitude}
                  onChangeText={setLongitude}
                  keyboardType="numeric"
                  placeholder="76.955833"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Radius Presets */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Allowed Attendance Radius (Meters)</Text>
              <View style={styles.presetsRow}>
                {RADIUS_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.presetChip,
                      radiusMeters === preset && styles.presetChipActive,
                    ]}
                    onPress={() => setRadiusMeters(preset)}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        radiusMeters === preset && styles.presetChipTextActive,
                      ]}
                    >
                      {preset}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.textInput, { marginTop: 8 }]}
                value={String(radiusMeters)}
                onChangeText={(val) => setRadiusMeters(parseInt(val, 10) || 0)}
                keyboardType="numeric"
                placeholder="Custom radius (e.g. 150)"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* 4. SAVE & APPLY BUTTON */}
          <TouchableOpacity
            style={[styles.saveButton, isSaving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.88}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.saveButtonText}>Save & Apply Geofence Perimeter</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0F172A',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#1E293B',
    borderRadius: 8,
  },
  backBtnText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 14,
  },
  centerBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  visualCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  visualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  visualTitle: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0A1E3F',
    letterSpacing: 0.5,
  },
  radiusPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  radiusPillText: {
    color: '#065F46',
    fontSize: 9.5,
    fontWeight: '800',
  },
  mapCanvas: {
    position: 'relative',
    height: 210,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coordsOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  coordsText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  distanceStatusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  distanceStatusTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  distanceStatusSub: {
    fontSize: 11,
    color: '#475569',
    marginTop: 2,
  },
  gpsCaptureButton: {
    backgroundColor: '#0066CC',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    shadowColor: '#0066CC',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  gpsCaptureText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  formCardTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  rowTwo: {
    flexDirection: 'row',
    gap: 10,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  presetChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  presetChipTextActive: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
