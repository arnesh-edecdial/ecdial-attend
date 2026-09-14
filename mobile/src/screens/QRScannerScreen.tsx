import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { mobileApi } from '../services/api';
import { formatTime12 } from '../utils/time';

interface QRScannerScreenProps {
  onClose: () => void;
  onSuccess: () => void;
  onRequestAttendance: () => void;
}

const BARCODE_SCANNER_SETTINGS: any = {
  barcodeTypes: ['qr'],
};

export const QRScannerScreen: React.FC<QRScannerScreenProps> = ({
  onClose,
  onSuccess,
  onRequestAttendance,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const autoCloseTimer = useRef<any>(null);

  // Result / Error State
  const [resultState, setResultState] = useState<{
    status: 'SUCCESS' | 'ERROR';
    title: string;
    message: string;
    checkInTime?: string;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        await Location.requestForegroundPermissionsAsync();
      } catch (e) {
        console.log('[QRScanner Location Check]', e);
      }
    })();

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });

    return () => {
      backHandler.remove();
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    };
  }, [onClose]);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isVerifying) return;
    setScanned(true);
    setIsVerifying(true);

    try {
      // 1. Fast location retrieval: Try last known first, then balanced with 3.5s timeout
      let lat = 11.0168;
      let lon = 76.9558;
      let accuracy = 15;

      try {
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
          lat = lastKnown.coords.latitude;
          lon = lastKnown.coords.longitude;
          accuracy = lastKnown.coords.accuracy || 15;
        } else {
          const timeoutPromise = new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('TIMEOUT')), 3500)
          );
          const currentPromise = Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });

          const loc: any = await Promise.race([currentPromise, timeoutPromise]);
          if (loc && loc.coords) {
            lat = loc.coords.latitude;
            lon = loc.coords.longitude;
            accuracy = loc.coords.accuracy || 15;
          }
        }
      } catch (e) {
        console.log('[QRScanner Location Note]', e);
      }

      // 2. Submit authoritative check-in / check-out to backend
      const res = await mobileApi.checkIn({
        qrToken: data,
        latitude: lat,
        longitude: lon,
        accuracy,
      });

      if (res.success) {
        const isCheckout = res.action === 'CHECK_OUT';
        setResultState({
          status: 'SUCCESS',
          title: isCheckout ? '✓ Checkout Successful' : '✓ Attendance Marked',
          message: res.message || (isCheckout ? `Closing Time: ${formatTime12(res.data?.checkOutTime)}\nWorked: ${res.data?.workingDuration}` : `Check-in\n${formatTime12(res.data?.checkInTime)}`),
          checkInTime: res.data?.checkInTime,
        });

        // Auto-close and refresh Home status
        autoCloseTimer.current = setTimeout(() => {
          onSuccess();
          onClose();
        }, 1800);
      }
    } catch (err: any) {
      if (err.errorType === 'DUPLICATE_CHECKIN') {
        setResultState({
          status: 'SUCCESS',
          title: 'Attendance Recorded',
          message: err.message,
        });
      } else if (err.errorType === 'OUT_OF_OFFICE_RADIUS' || err.errorType === 'OUTSIDE_OFFICE') {
        setResultState({
          status: 'ERROR',
          title: "Outside Office Perimeter",
          message: err.message || 'Please scan within the configured office perimeter.',
        });
      } else if (err.errorType === 'INVALID_QR') {
        setResultState({
          status: 'ERROR',
          title: 'Invalid Office QR',
          message: 'Please scan the official ECDIAL office attendance QR.',
        });
      } else if (err.errorType === 'COMPANY_LEAVE') {
        setResultState({
          status: 'SUCCESS',
          title: 'Company Holiday',
          message: err.message || 'Today is marked as a company holiday.',
        });
      } else {
        setResultState({
          status: 'ERROR',
          title: 'Scan Error',
          message: err.message || 'Unable to record attendance. Please try again.',
        });
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleTryAgain = () => {
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
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
              if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
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
        barcodeScannerSettings={BARCODE_SCANNER_SETTINGS}
        enableTorch={torchOn}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      <SafeAreaView style={[StyleSheet.absoluteFillObject, styles.overlay]} edges={['top', 'left', 'right', 'bottom']}>
        {/* Top Header */}
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
              <ActivityIndicator size="large" color="#00E5FF" />
              <Text style={styles.verifyingText}>Verifying attendance...</Text>
            </View>
          )}
        </View>

        {/* Bottom Controls (Flashlight & Cancel) */}
        <View style={styles.bottomControls}>
          <TouchableOpacity
            style={[styles.torchButton, torchOn && styles.torchButtonActive]}
            onPress={() => setTorchOn(!torchOn)}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 20 }}>{torchOn ? '🔦' : '💡'}</Text>
            <Text style={[styles.torchButtonText, torchOn && styles.torchButtonTextActive]}>
              {torchOn ? 'Flashlight ON' : 'Flashlight'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.cancelText}>✕ Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
    paddingTop: 16,
    paddingBottom: 24,
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
  bottomControls: {
    alignItems: 'center',
    gap: 16,
    width: '100%',
    paddingBottom: 24,
  },
  torchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  torchButtonActive: {
    backgroundColor: '#0066CC',
    borderColor: '#38BDF8',
  },
  torchButtonText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  torchButtonTextActive: {
    color: '#FFFFFF',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 99,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
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
