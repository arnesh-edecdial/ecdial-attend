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
  const [offices, setOffices] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number>(1); // 1, 2, or 3

  const [officeName, setOfficeName] = useState<string>('ECDIAL Tiruppur');
  const [address, setAddress] = useState<string>('');
  const [latitude, setLatitude] = useState<string>('11.1085');
  const [longitude, setLongitude] = useState<string>('77.3411');
  const [radiusMeters, setRadiusMeters] = useState<number>(200);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isFetchingGps, setIsFetchingGps] = useState<boolean>(false);

  // Admin device live distance preview
  const [adminCoords, setAdminCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [liveDistance, setLiveDistance] = useState<number | null>(null);

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

  const populateSlotData = (slotNum: number, officeList: any[]) => {
    const target = officeList.find((o) => (o.slotIndex || 1) === slotNum) || officeList[slotNum - 1];
    if (target) {
      setOfficeName(target.officeName || `Office ${slotNum}`);
      setAddress(target.address || '');
      setLatitude(String(target.latitude || 11.0168));
      setLongitude(String(target.longitude || 76.9558));
      setRadiusMeters(Number(target.allowedRadiusMeters) || 200);
    }
  };

  const loadConfig = async () => {
    try {
      setIsLoading(true);
      const res = await mobileApi.listOfficeConfigs();
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        setOffices(res.data);
        populateSlotData(selectedSlot, res.data);
      }

      // Check admin device current location for live distance test (without prompting)
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const currentLoc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (currentLoc && currentLoc.coords) {
          setAdminCoords({
            lat: currentLoc.coords.latitude,
            lon: currentLoc.coords.longitude,
          });
        }
      }
    } catch (err: any) {
      console.error('[Load Office Configs Error]', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  const handleSelectSlot = (slotNum: number) => {
    setSelectedSlot(slotNum);
    populateSlotData(slotNum, offices);
  };

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

    const currentOffice = offices.find((o) => (o.slotIndex || 1) === selectedSlot) || offices[selectedSlot - 1];
    if (!currentOffice || !currentOffice.id) {
      Alert.alert('Error', 'Unable to find office slot record to update.');
      return;
    }

    try {
      setIsSaving(true);
      const res = await mobileApi.updateOfficeSlot(currentOffice.id, {
        officeName: officeName.trim() || `ECDIAL Office ${selectedSlot}`,
        address: address ? address.trim() : null,
        latitude: latNum,
        longitude: lonNum,
        allowedRadiusMeters: radiusMeters,
        slotIndex: selectedSlot,
      });

      if (res && res.success) {
        // Update local state
        const updatedList = offices.map((o) => (o.id === currentOffice.id ? res.data : o));
        setOffices(updatedList);

        Alert.alert(
          '✓ Office Calibrated',
          `Office ${selectedSlot} (${res.data.officeName}) updated successfully. Radius: ${radiusMeters}m.`
        );
        if (onSaved) onSaved();
      } else {
        Alert.alert('Error', res?.message || 'Failed to save office configuration.');
      }
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Unable to update office configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const RADIUS_PRESETS = [50, 100, 200, 500, 1000];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>3 Office Locations</Text>
          <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Configure ECDIAL branch GPS coordinates & perimeters</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#64748B' }}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* 3 OFFICE LOCATION TAB SWITCHER */}
      <View style={styles.officeTabRow}>
        {[1, 2, 3].map((slotNum) => {
          const off = offices.find((o) => (o.slotIndex || 1) === slotNum) || offices[slotNum - 1];
          const isSelected = selectedSlot === slotNum;
          const label = off?.officeName ? off.officeName.replace('ECDIAL ', '') : `Office ${slotNum}`;

          return (
            <TouchableOpacity
              key={slotNum}
              style={[styles.officeTab, isSelected && styles.officeTabActive]}
              onPress={() => handleSelectSlot(slotNum)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 12 }}>🏢</Text>
              <Text
                style={[styles.officeTabText, isSelected && styles.officeTabTextActive]}
                numberOfLines={1}
              >
                {label}
              </Text>
              {isSelected && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingText}>Loading office locations...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* VISUAL GEOFENCE RADAR / MAP CARD */}
          <View style={styles.visualCard}>
            <View style={styles.visualHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 16 }}>📍</Text>
                <Text style={styles.visualTitle}>LOCATION {selectedSlot} RADAR</Text>
              </View>
              <View style={styles.radiusPill}>
                <Text style={styles.radiusPillText}>{radiusMeters}M RADIUS</Text>
              </View>
            </View>

            {/* Stylized Vector Map & Pulse Geofence Circle */}
            <View style={styles.mapCanvas}>
              <Svg width="100%" height={170} viewBox="0 0 320 170">
                <Rect x="0" y="0" width="320" height="170" fill="#F1F5F9" />
                <Path d="M 0,35 Q 90,50 160,25 T 320,40" stroke="#E2E8F0" strokeWidth="10" fill="none" />
                <Path d="M 40,0 Q 60,90 30,170" stroke="#E2E8F0" strokeWidth="8" fill="none" />
                <Path d="M 160,0 L 160,170" stroke="#E2E8F0" strokeWidth="6" fill="none" />
                <Path d="M 0,130 Q 150,115 320,140" stroke="#E2E8F0" strokeWidth="10" fill="none" />
                <Path d="M 270,0 Q 250,80 290,170" stroke="#E2E8F0" strokeWidth="8" fill="none" />

                {/* Outer Geofence Halo Ring */}
                <Circle cx="160" cy="85" r="65" fill="rgba(16, 185, 129, 0.08)" stroke="#10B981" strokeWidth="1.5" strokeDasharray="4,4" />
                {/* Inner Geofence Zone */}
                <Circle cx="160" cy="85" r="45" fill="rgba(16, 185, 129, 0.20)" stroke="#10B981" strokeWidth="2" />
                {/* Inner Center Radar Ping */}
                <Circle cx="160" cy="85" r="14" fill="rgba(16, 185, 129, 0.35)" />

                {/* Center Pin Marker */}
                <G transform="translate(148, 62)">
                  <Path
                    d="M 12 0 C 5.37 0 0 5.37 0 12 C 0 21 12 30 12 30 C 12 30 24 21 24 12 C 24 5.37 18.63 0 12 0 Z"
                    fill="#0A1E3F"
                  />
                  <Circle cx="12" cy="11" r="7" fill="#FFFFFF" />
                  <Circle cx="12" cy="11" r="4" fill="#0066CC" />
                </G>
              </Svg>
            </View>

            {/* Live Distance Meter */}
            <View style={styles.distanceBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor:
                      liveDistance === null ? '#94A3B8' : liveDistance <= radiusMeters ? '#10B981' : '#EF4444',
                  }}
                />
                <Text style={styles.distanceLabel}>Your Device Distance to Office {selectedSlot}:</Text>
              </View>
              <Text
                style={[
                  styles.distanceValue,
                  { color: liveDistance === null ? '#64748B' : liveDistance <= radiusMeters ? '#10B981' : '#EF4444' },
                ]}
              >
                {liveDistance !== null ? `${liveDistance} m` : 'Calculating...'}
              </Text>
            </View>
          </View>

          {/* 2. OFFICE FORM INPUTS */}
          <View style={styles.formCard}>
            <Text style={styles.sectionTitle}>Office {selectedSlot} Details</Text>

            {/* Office Name */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>OFFICE / BRANCH NAME</Text>
              <TextInput
                style={styles.textInput}
                value={officeName}
                onChangeText={setOfficeName}
                placeholder="e.g. ECDIAL Tiruppur"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Address / Location */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>ADDRESS / LOCATION DETAILS</Text>
              <TextInput
                style={[styles.textInput, { height: 42 }]}
                value={address}
                onChangeText={setAddress}
                placeholder="e.g. Avinashi Road, Tiruppur, Tamil Nadu"
                placeholderTextColor="#94A3B8"
              />
            </View>

            {/* Coordinates Row */}
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>LATITUDE</Text>
                <TextInput
                  style={styles.textInput}
                  value={latitude}
                  onChangeText={setLatitude}
                  keyboardType="numeric"
                  placeholder="11.0168"
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.inputLabel}>LONGITUDE</Text>
                <TextInput
                  style={styles.textInput}
                  value={longitude}
                  onChangeText={setLongitude}
                  keyboardType="numeric"
                  placeholder="76.9558"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Use Current Device Location Button */}
            <TouchableOpacity
              style={styles.gpsBtn}
              onPress={handleUseCurrentLocation}
              disabled={isFetchingGps}
              activeOpacity={0.8}
            >
              {isFetchingGps ? (
                <ActivityIndicator size="small" color="#0066CC" />
              ) : (
                <>
                  <Text style={{ fontSize: 16 }}>🎯</Text>
                  <Text style={styles.gpsBtnText}>Use My Current Device Location</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Radius Presets */}
            <View style={[styles.inputGroup, { marginTop: 14 }]}>
              <Text style={styles.inputLabel}>ALLOWED ATTENDANCE PERIMETER RADIUS</Text>
              <View style={styles.presetsRow}>
                {RADIUS_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset}
                    style={[styles.presetChip, radiusMeters === preset && styles.presetChipActive]}
                    onPress={() => setRadiusMeters(preset)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.presetText, radiusMeters === preset && styles.presetTextActive]}>
                      {preset}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Custom Radius Input */}
            <View style={[styles.inputGroup, { marginTop: 8 }]}>
              <Text style={{ fontSize: 11, color: '#64748B', marginBottom: 4 }}>Or Custom Radius (meters):</Text>
              <TextInput
                style={styles.textInput}
                value={String(radiusMeters)}
                onChangeText={(val) => {
                  const n = parseInt(val, 10);
                  if (!isNaN(n)) setRadiusMeters(n);
                  else if (val === '') setRadiusMeters(0);
                }}
                keyboardType="numeric"
                placeholder="200"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          {/* SAVE BUTTON */}
          <TouchableOpacity
            style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={isSaving}
            activeOpacity={0.8}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save Office {selectedSlot} Configuration</Text>
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
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0A1E3F',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  officeTabRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  officeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  officeTabActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#0066CC',
  },
  officeTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  officeTabTextActive: {
    color: '#0066CC',
    fontWeight: '700',
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#0066CC',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 10,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  visualCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  visualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  visualTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
  },
  radiusPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  radiusPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  mapCanvas: {
    width: '100%',
    height: 170,
    backgroundColor: '#F1F5F9',
  },
  distanceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  distanceLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  distanceValue: {
    fontSize: 12,
    fontWeight: '800',
  },
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0A1E3F',
    marginBottom: 14,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0A1E3F',
    fontWeight: '500',
  },
  gpsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F0F9FF',
    borderWidth: 1,
    borderColor: '#BAE6FD',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 4,
  },
  gpsBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0066CC',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  presetChipActive: {
    backgroundColor: '#0066CC',
    borderColor: '#0066CC',
  },
  presetText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  presetTextActive: {
    color: '#FFFFFF',
  },
  saveBtn: {
    backgroundColor: '#0066CC',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0066CC',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
