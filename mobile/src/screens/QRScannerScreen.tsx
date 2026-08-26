import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { mobileApi } from '../services/api';

interface QRScannerScreenProps {
  onClose: () => void;
  onSuccess: () => void;
  onRequestAttendance: () => void;
}

export const QRScannerScreen: React.FC<QRScannerScreenProps> = ({
  onClose,
  onSuccess,
  onRequestAttendance,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Result / Error State
  const [resultState, setResultState] = useState<{
    status: 'SUCCESS' | 'ERROR';
    title: string;
    message: string;
    checkInTime?: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      await Location.requestForegroundPermissionsAsync();
    })();
  }, []);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isVerifying) return;
    setScanned(true);
    setIsVerifying(true);

    try {
      // 1. Obtain device location & accuracy
      let location = null;
      try {
        location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
      } catch (e) {
        // GPS permission / sensor issue
        setResultState({
          status: 'ERROR',
          title: 'Unable to verify your location.',
          message: 'Please enable location and try again.',
        });
        setIsVerifying(false);
        return;
      }

      const lat = location.coords.latitude;
      const lon = location.coords.longitude;
      const accuracy = location.coords.accuracy || 15;

      // 2. Submit authoritative check-in to Node.js backend
      const res = await mobileApi.checkIn({
        qrToken: data,
        latitude: lat,
        longitude: lon,
        accuracy,
      });

      if (res.success) {
        setResultState({
          status: 'SUCCESS',
          title: '✓ Attendance Marked',
          message: `Check-in\n${res.data.checkInTime}`,
          checkInTime: res.data.checkInTime,
        });
      }
    } catch (err: any) {
      if (err.errorType === 'DUPLICATE_CHECKIN') {
        setResultState({
          status: 'SUCCESS',
          title: 'Attendance already marked.',
          message: err.message,
        });
      } else if (err.errorType === 'OUTSIDE_OFFICE') {
        setResultState({
          status: 'ERROR',
          title: "You're outside the allowed attendance area.",
          message: 'Please scan within the configured office perimeter.',
        });
      } else if (err.errorType === 'INVALID_QR') {
        setResultState({
          status: 'ERROR',
          title: 'QR code is invalid or expired.',
          message: 'Please scan the live rotating QR on the office screen.',
        });
      } else {
        setResultState({
          status: 'ERROR',
          title: 'Unable to verify your location.',
          message: err.message || 'Please enable location and try again.',
        });
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTryAgain = () => {
    setScanned(false);
    setResultState(null);
  };

  if (!permission) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Camera Permission Required</Text>
        <Text style={styles.errorSubtitle}>ECDIAL needs direct camera access to scan the attendance QR code.</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
          <Text style={styles.secondaryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Result overlay screen (Success or Friendly Failure)
  if (resultState) {
    const isSuccess = resultState.status === 'SUCCESS';
    return (
      <View style={styles.centerContainer}>
        <View style={[styles.resultCircle, { backgroundColor: isSuccess ? '#064E3B' : '#7F1D1D' }]}>
          <Text style={{ fontSize: 36, color: '#FFFFFF' }}>{isSuccess ? '✓' : '⚠'}</Text>
        </View>

        <Text style={[styles.resultTitle, { color: isSuccess ? '#10B981' : '#EF4444' }]}>
          {resultState.title}
        </Text>

        <Text style={styles.resultMessage}>{resultState.message}</Text>

        {isSuccess ? (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: '#10B981', marginTop: 30 }]}
            onPress={() => {
              onSuccess();
              onClose();
            }}
          >
            <Text style={styles.buttonText}>Done</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: '100%', marginTop: 24, gap: 12 }}>
            <TouchableOpacity style={styles.primaryButton} onPress={handleTryAgain}>
              <Text style={styles.buttonText}>[ TRY AGAIN ]</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={onRequestAttendance}>
              <Text style={styles.secondaryButtonText}>[ REQUEST ATTENDANCE ]</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          <View style={styles.header}>
            <Text style={styles.overlayTitle}>Scan Attendance QR</Text>
            <Text style={styles.overlaySub}>Align the office display QR within the frame</Text>
          </View>

          {/* Scanner Box Target */}
          <View style={styles.scanTarget}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            {isVerifying && (
              <View style={styles.verifyingOverlay}>
                <ActivityIndicator size="large" color="#0066CC" />
                <Text style={styles.verifyingText}>Verifying with server...</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#0A0F1D',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 50,
  },
  header: {
    alignItems: 'center',
  },
  overlayTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  overlaySub: {
    fontSize: 13,
    color: '#CBD5E1',
    marginTop: 4,
  },
  scanTarget: {
    width: 250,
    height: 250,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#0066CC',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  verifyingOverlay: {
    backgroundColor: 'rgba(10, 15, 29, 0.9)',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  verifyingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 10,
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 99,
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  resultCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  resultMessage: {
    fontSize: 15,
    color: '#CBD5E1',
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#0066CC',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  errorSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 20,
  },
});
