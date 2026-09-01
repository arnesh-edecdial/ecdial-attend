import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
  TextInput,
} from 'react-native';

interface MaterialAnalogClockPickerProps {
  visible: boolean;
  initialHour?: number; // 1 - 12
  initialMinute?: number; // 0 - 59
  initialPeriod?: 'AM' | 'PM';
  title?: string;
  onConfirm: (hour: number, minute: number, period: 'AM' | 'PM') => void;
  onCancel: () => void;
}

export const MaterialAnalogClockPicker: React.FC<MaterialAnalogClockPickerProps> = ({
  visible,
  initialHour = 9,
  initialMinute = 0,
  initialPeriod = 'AM',
  title = 'Set Time',
  onConfirm,
  onCancel,
}) => {
  const [hour, setHour] = useState<number>(initialHour);
  const [minute, setMinute] = useState<number>(initialMinute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initialPeriod);
  const [mode, setMode] = useState<'HOUR' | 'MINUTE'>('HOUR');
  const [isKeyboardMode, setIsKeyboardMode] = useState<boolean>(false);

  // Manual numeric input state
  const [inputHour, setInputHour] = useState<string>(String(initialHour));
  const [inputMinute, setInputMinute] = useState<string>(String(initialMinute).padStart(2, '0'));

  useEffect(() => {
    if (visible) {
      setHour(initialHour || 9);
      setMinute(initialMinute || 0);
      setPeriod(initialPeriod || 'AM');
      setMode('HOUR');
      setIsKeyboardMode(false);
      setInputHour(String(initialHour || 9));
      setInputMinute(String(initialMinute || 0).padStart(2, '0'));
    }
  }, [visible, initialHour, initialMinute, initialPeriod]);

  const DIAL_SIZE = 240;
  const RADIUS = DIAL_SIZE / 2;
  const NUMBER_RADIUS = RADIUS - 28;

  const hoursList = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutesList = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  // Calculate coordinates for 12 clock positions
  const getCoordinates = (index: number) => {
    // index 0 is 12 o'clock (-90 degrees)
    const angle = (index * 30 - 90) * (Math.PI / 180);
    const x = RADIUS + NUMBER_RADIUS * Math.cos(angle);
    const y = RADIUS + NUMBER_RADIUS * Math.sin(angle);
    return { x, y, angle };
  };

  // Selected angle for hand line
  const selectedIndex =
    mode === 'HOUR'
      ? hoursList.indexOf(hour === 0 ? 12 : hour)
      : Math.round(minute / 5) % 12;

  const selectedCoords = getCoordinates(selectedIndex >= 0 ? selectedIndex : 0);

  const handleSelectHour = (h: number) => {
    setHour(h);
    setInputHour(String(h));
    // Auto advance to minute mode
    setTimeout(() => {
      setMode('MINUTE');
    }, 220);
  };

  const handleSelectMinute = (m: number) => {
    setMinute(m);
    setInputMinute(String(m).padStart(2, '0'));
  };

  const handleConfirm = () => {
    if (isKeyboardMode) {
      const h = Math.max(1, Math.min(12, parseInt(inputHour, 10) || 12));
      const m = Math.max(0, Math.min(59, parseInt(inputMinute, 10) || 0));
      onConfirm(h, m, period);
    } else {
      onConfirm(hour, minute, period);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.dialogCard}>
          {/* Top Title */}
          <Text style={styles.dialogTitle}>{title}</Text>

          {/* Time Display Header (Image 5 Reference) */}
          <View style={styles.headerDisplayRow}>
            {/* Big Digits Box */}
            <View style={styles.timeDigitsWrapper}>
              {/* Hour Box */}
              <TouchableOpacity
                style={[styles.digitBox, mode === 'HOUR' && !isKeyboardMode && styles.digitBoxActive]}
                onPress={() => {
                  setMode('HOUR');
                  setIsKeyboardMode(false);
                }}
                activeOpacity={0.8}
              >
                {isKeyboardMode ? (
                  <TextInput
                    style={styles.keyboardInput}
                    value={inputHour}
                    onChangeText={(t) => setInputHour(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                  />
                ) : (
                  <Text style={[styles.digitText, mode === 'HOUR' && styles.digitTextActive]}>
                    {hour}
                  </Text>
                )}
              </TouchableOpacity>

              <Text style={styles.colonSeparator}>:</Text>

              {/* Minute Box */}
              <TouchableOpacity
                style={[styles.digitBox, mode === 'MINUTE' && !isKeyboardMode && styles.digitBoxActive]}
                onPress={() => {
                  setMode('MINUTE');
                  setIsKeyboardMode(false);
                }}
                activeOpacity={0.8}
              >
                {isKeyboardMode ? (
                  <TextInput
                    style={styles.keyboardInput}
                    value={inputMinute}
                    onChangeText={(t) => setInputMinute(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={2}
                    selectTextOnFocus
                  />
                ) : (
                  <Text style={[styles.digitText, mode === 'MINUTE' && styles.digitTextActive]}>
                    {String(minute).padStart(2, '0')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {/* AM / PM Toggle Stack */}
            <View style={styles.periodStack}>
              <TouchableOpacity
                style={[styles.periodBtn, period === 'AM' && styles.periodBtnActive]}
                onPress={() => setPeriod('AM')}
                activeOpacity={0.8}
              >
                <Text style={[styles.periodText, period === 'AM' && styles.periodTextActive]}>AM</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.periodBtn, period === 'PM' && styles.periodBtnActive]}
                onPress={() => setPeriod('PM')}
                activeOpacity={0.8}
              >
                <Text style={[styles.periodText, period === 'PM' && styles.periodTextActive]}>PM</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Clock Dial View */}
          {!isKeyboardMode ? (
            <View style={styles.dialContainer}>
              <View style={[styles.clockFace, { width: DIAL_SIZE, height: DIAL_SIZE, borderRadius: RADIUS }]}>
                {/* Center Pivot Dot */}
                <View style={styles.centerPivot} />

                {/* Pointer Line */}
                <View
                  style={[
                    styles.pointerLine,
                    {
                      width: NUMBER_RADIUS,
                      transform: [
                        { translateX: 0 },
                        { translateY: 0 },
                        { rotate: `${selectedIndex * 30 - 90}deg` },
                      ],
                    },
                  ]}
                />

                {/* Clock Numbers */}
                {(mode === 'HOUR' ? hoursList : minutesList).map((val, idx) => {
                  const { x, y } = getCoordinates(idx);
                  const isSelected =
                    mode === 'HOUR' ? (hour === 0 ? 12 : hour) === val : minute === val;

                  return (
                    <TouchableOpacity
                      key={`clock-${val}-${idx}`}
                      style={[
                        styles.numberNode,
                        { left: x - 18, top: y - 18 },
                        isSelected && styles.numberNodeSelected,
                      ]}
                      onPress={() => (mode === 'HOUR' ? handleSelectHour(val) : handleSelectMinute(val))}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.numberText, isSelected && styles.numberTextSelected]}>
                        {mode === 'HOUR' ? val : String(val).padStart(2, '0')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={styles.keyboardPromptBox}>
              <Text style={styles.keyboardPromptText}>Enter hour (1-12) and minute (00-59) above</Text>
            </View>
          )}

          {/* Footer Actions */}
          <View style={styles.dialogFooter}>
            <TouchableOpacity
              style={styles.keyboardToggleBtn}
              onPress={() => setIsKeyboardMode(!isKeyboardMode)}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20 }}>{isKeyboardMode ? '🕒' : '⌨️'}</Text>
            </TouchableOpacity>

            <View style={styles.actionButtonsRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.okBtn} onPress={handleConfirm} activeOpacity={0.8}>
                <Text style={styles.okBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#1E222B', // Dark Material Dialog Theme
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
  },
  dialogTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  headerDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  timeDigitsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  digitBox: {
    width: 64,
    height: 58,
    backgroundColor: '#2A303C',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  digitBoxActive: {
    backgroundColor: '#1E3A8A',
    borderColor: '#3B82F6',
  },
  digitText: {
    fontSize: 34,
    fontWeight: '800',
    color: '#F8FAFC',
    fontFamily: 'System',
  },
  digitTextActive: {
    color: '#60A5FA',
  },
  keyboardInput: {
    fontSize: 34,
    fontWeight: '800',
    color: '#60A5FA',
    textAlign: 'center',
    width: '100%',
    height: '100%',
  },
  colonSeparator: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F8FAFC',
    marginHorizontal: 2,
  },
  periodStack: {
    borderWidth: 1,
    borderColor: '#374151',
    borderRadius: 10,
    overflow: 'hidden',
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#2A303C',
  },
  periodBtnActive: {
    backgroundColor: '#3B82F6',
  },
  periodText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94A3B8',
  },
  periodTextActive: {
    color: '#FFFFFF',
  },
  dialContainer: {
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockFace: {
    backgroundColor: '#2D333F',
    position: 'relative',
  },
  centerPivot: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 8,
    height: 8,
    marginLeft: -4,
    marginTop: -4,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
    zIndex: 5,
  },
  pointerLine: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    height: 2,
    backgroundColor: '#3B82F6',
    transformOrigin: '0% 50%',
    zIndex: 2,
  },
  numberNode: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 4,
  },
  numberNodeSelected: {
    backgroundColor: '#3B82F6',
  },
  numberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  numberTextSelected: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  keyboardPromptBox: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  keyboardPromptText: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  dialogFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 16,
    paddingTop: 8,
  },
  keyboardToggleBtn: {
    padding: 8,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94A3B8',
  },
  okBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
  },
  okBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
