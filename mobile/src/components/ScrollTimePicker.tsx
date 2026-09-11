import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Rect } from 'react-native-svg';

export interface TimePickerValue {
  hour12: number;
  minute: number;
  period: 'AM' | 'PM';
  hour24: number;
  formatted24: string; // "HH:mm"
  formatted12: string; // "hh:mm A"
}

export interface ScrollTimePickerModalProps {
  visible: boolean;
  initialTime?: string; // e.g. "14:30" or "08:30"
  initialHour?: number; // 1-12
  initialMinute?: number; // 0-59
  initialPeriod?: 'AM' | 'PM';
  title?: string;
  maxTime?: { hour24: number; minute: number }; // Disallow future times (e.g. for today)
  minTime?: { hour24: number; minute: number };
  onConfirm: (time: TimePickerValue) => void;
  onCancel: () => void;
}

const ITEM_H = 44;
const WHEEL_H = 220;
const PAD_H = (WHEEL_H - ITEM_H) / 2; // 88px (2 items above, 2 items below, 1 centered)

const HOURS = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // standard clock sequence
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const PERIODS: ('AM' | 'PM')[] = ['AM', 'PM'];

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

export function computeHour24(h12: number, period: 'AM' | 'PM'): number {
  const norm = h12 % 12;
  return period === 'AM' ? norm : norm + 12;
}

export function parse24HourString(timeStr?: string | null): {
  hour12: number;
  minute: number;
  period: 'AM' | 'PM';
  hour24: number;
} {
  if (!timeStr || typeof timeStr !== 'string' || !timeStr.includes(':')) {
    return { hour12: 12, minute: 0, period: 'PM', hour24: 12 };
  }
  const parts = timeStr.trim().split(':');
  const h24 = parseInt(parts[0], 10) || 0;
  const min = parseInt(parts[1], 10) || 0;
  const validH24 = Math.max(0, Math.min(23, h24));
  const validMin = Math.max(0, Math.min(59, min));

  const period: 'AM' | 'PM' = validH24 >= 12 ? 'PM' : 'AM';
  let hour12 = validH24 % 12;
  if (hour12 === 0) hour12 = 12;

  return { hour12, minute: validMin, period, hour24: validH24 };
}

interface ColumnProps<T> {
  items: T[];
  selectedValue: T;
  onSelect: (val: T) => void;
  renderLabel: (val: T) => string;
  isItemDisabled?: (val: T) => boolean;
}

function WheelColumn<T extends number | string>({
  items,
  selectedValue,
  onSelect,
  renderLabel,
  isItemDisabled,
}: ColumnProps<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const isUserScrolling = useRef<boolean>(false);
  const selectedIndex = items.indexOf(selectedValue);

  // Sync scroll position when selectedValue changes externally
  useEffect(() => {
    if (!isUserScrolling.current && selectedIndex >= 0) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: selectedIndex * ITEM_H, animated: false });
      }, 50);
    }
  }, [selectedValue, items]);

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    let idx = Math.round(y / ITEM_H);
    idx = Math.max(0, Math.min(items.length - 1, idx));

    isUserScrolling.current = false;

    // Check if the landed item is disabled. If disabled, find the closest valid item!
    if (isItemDisabled && isItemDisabled(items[idx])) {
      let closestIdx = -1;
      for (let offset = 1; offset < items.length; offset++) {
        if (idx - offset >= 0 && !isItemDisabled(items[idx - offset])) {
          closestIdx = idx - offset;
          break;
        }
        if (idx + offset < items.length && !isItemDisabled(items[idx + offset])) {
          closestIdx = idx + offset;
          break;
        }
      }

      if (closestIdx >= 0) {
        idx = closestIdx;
        scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: true });
      }
    }

    const val = items[idx];
    if (val !== undefined && (!isItemDisabled || !isItemDisabled(val))) {
      onSelect(val);
    }
  };

  const handleItemPress = (item: T, idx: number) => {
    if (isItemDisabled && isItemDisabled(item)) return;
    scrollRef.current?.scrollTo({ y: idx * ITEM_H, animated: true });
    onSelect(item);
  };

  return (
    <View style={styles.column}>
      <ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate={Platform.OS === 'ios' ? 'normal' : 'fast'}
        contentContainerStyle={{ paddingTop: PAD_H, paddingBottom: PAD_H }}
        onScrollBeginDrag={() => {
          isUserScrolling.current = true;
        }}
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={(e) => {
          if (Platform.OS === 'android') {
            handleScrollEnd(e);
          }
        }}
      >
        {items.map((item, idx) => {
          const isSelected = item === selectedValue;
          const dist = Math.abs(idx - selectedIndex);
          const disabled = isItemDisabled ? isItemDisabled(item) : false;

          let itemColor = '#5f6368';
          let itemSize = 20;
          let itemOpacity = 0.35;
          let fontWeight: '400' | '600' | '700' = '400';

          if (disabled) {
            itemColor = '#333333';
            itemOpacity = 0.15;
            itemSize = 18;
          } else if (isSelected) {
            itemColor = '#8ab4f8';
            itemSize = 26;
            itemOpacity = 1;
            fontWeight = '700';
          } else if (dist === 1) {
            itemColor = '#9aa0a6';
            itemSize = 22;
            itemOpacity = 0.65;
            fontWeight = '600';
          }

          return (
            <TouchableOpacity
              key={String(item)}
              activeOpacity={disabled ? 1 : 0.7}
              onPress={() => handleItemPress(item, idx)}
              style={styles.itemRow}
            >
              <Text
                style={[
                  styles.itemText,
                  {
                    color: itemColor,
                    fontSize: itemSize,
                    opacity: itemOpacity,
                    fontWeight,
                  },
                ]}
              >
                {renderLabel(item)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export const ScrollTimePickerModal: React.FC<ScrollTimePickerModalProps> = ({
  visible,
  initialTime,
  initialHour,
  initialMinute,
  initialPeriod,
  title = 'Select Time',
  maxTime,
  minTime,
  onConfirm,
  onCancel,
}) => {
  const [hour, setHour] = useState<number>(12);
  const [minute, setMinute] = useState<number>(0);
  const [period, setPeriod] = useState<'AM' | 'PM'>('PM');

  // Initialize state when modal opens
  useEffect(() => {
    if (!visible) return;

    let h = 12;
    let m = 0;
    let p: 'AM' | 'PM' = 'PM';

    if (initialTime) {
      const parsed = parse24HourString(initialTime);
      h = parsed.hour12;
      m = parsed.minute;
      p = parsed.period;
    } else {
      h = initialHour !== undefined ? initialHour : 12;
      m = initialMinute !== undefined ? initialMinute : 0;
      p = initialPeriod || 'PM';
    }

    // Clamp if maxTime is provided and initial exceeds maxTime
    if (maxTime) {
      const totalMins = computeHour24(h, p) * 60 + m;
      const maxMins = maxTime.hour24 * 60 + maxTime.minute;
      if (totalMins > maxMins) {
        p = maxTime.hour24 >= 12 ? 'PM' : 'AM';
        let clampedH12 = maxTime.hour24 % 12;
        if (clampedH12 === 0) clampedH12 = 12;
        h = clampedH12;
        m = maxTime.minute;
      }
    }

    setHour(h);
    setMinute(m);
    setPeriod(p);
  }, [visible, initialTime, initialHour, initialMinute, initialPeriod, maxTime]);

  // Check if period is disabled based on maxTime
  const isPeriodDisabled = (p: 'AM' | 'PM') => {
    if (!maxTime) return false;
    // If maxTime is in AM (< 12), then PM is completely in the future!
    if (p === 'PM' && maxTime.hour24 < 12) {
      return true;
    }
    return false;
  };

  // Check if hour is disabled based on maxTime & current period
  const isHourDisabled = (h: number) => {
    if (!maxTime) return false;
    const h24 = computeHour24(h, period);
    // An hour is disabled if even its 0th minute is in the future
    const hourStartMins = h24 * 60;
    const maxMins = maxTime.hour24 * 60 + maxTime.minute;
    return hourStartMins > maxMins;
  };

  // Check if minute is disabled based on current hour, period & maxTime
  const isMinuteDisabled = (m: number) => {
    if (!maxTime) return false;
    const h24 = computeHour24(hour, period);
    const totalMins = h24 * 60 + m;
    const maxMins = maxTime.hour24 * 60 + maxTime.minute;
    return totalMins > maxMins;
  };

  // When period changes, ensure hour & minute are not exceeding maxTime
  const handlePeriodChange = (newPeriod: 'AM' | 'PM') => {
    setPeriod(newPeriod);
    if (maxTime) {
      const h24 = computeHour24(hour, newPeriod);
      const totalMins = h24 * 60 + minute;
      const maxMins = maxTime.hour24 * 60 + maxTime.minute;
      if (totalMins > maxMins) {
        let clampedH12 = maxTime.hour24 % 12;
        if (clampedH12 === 0) clampedH12 = 12;
        setHour(clampedH12);
        setMinute(maxTime.minute);
      }
    }
  };

  // When hour changes, ensure minute is not exceeding maxTime
  const handleHourChange = (newHour: number) => {
    setHour(newHour);
    if (maxTime) {
      const h24 = computeHour24(newHour, period);
      const totalMins = h24 * 60 + minute;
      const maxMins = maxTime.hour24 * 60 + maxTime.minute;
      if (totalMins > maxMins) {
        setMinute(maxTime.minute);
      }
    }
  };

  const handleConfirm = () => {
    const h24 = computeHour24(hour, period);
    const formatted24 = `${pad(h24)}:${pad(minute)}`;
    const formatted12 = `${pad(hour)}:${pad(minute)} ${period}`;

    onConfirm({
      hour12: hour,
      minute,
      period,
      hour24: h24,
      formatted24,
      formatted12,
    });
  };

  const currentH24 = computeHour24(hour, period);
  const previewTime = `${pad(hour)}:${pad(minute)} ${period}`;

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.timePickerContainer}>
          {/* Header */}
          <Text style={styles.headerTitle}>{title}</Text>
          {maxTime && (
            <Text style={styles.maxTimeNotice}>
              Cannot select future time (Current limit: {pad(maxTime.hour24)}:{pad(maxTime.minute)})
            </Text>
          )}

          {/* Wheel Area */}
          <View style={styles.wheelArea}>
            {/* Center Selection Window */}
            <View style={styles.selectionWindow} pointerEvents="none" />

            {/* Columns */}
            <View style={styles.columnsRow}>
              {/* Hour Column */}
              <WheelColumn
                items={HOURS}
                selectedValue={hour}
                onSelect={handleHourChange}
                renderLabel={(h) => String(h)}
                isItemDisabled={isHourDisabled}
              />

              {/* Colon Separator */}
              <View style={styles.separatorContainer} pointerEvents="none">
                <Text style={styles.separatorText}>:</Text>
              </View>

              {/* Minute Column */}
              <WheelColumn
                items={MINUTES}
                selectedValue={minute}
                onSelect={setMinute}
                renderLabel={(m) => pad(m)}
                isItemDisabled={isMinuteDisabled}
              />

              {/* Period Column */}
              <WheelColumn
                items={PERIODS}
                selectedValue={period}
                onSelect={handlePeriodChange}
                renderLabel={(p) => p}
                isItemDisabled={isPeriodDisabled}
              />
            </View>

            {/* Top Fade Gradient */}
            <View style={styles.fadeTop} pointerEvents="none">
              <Svg height={60} width="100%">
                <Defs>
                  <SvgLinearGradient id="fadeTopGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#151515" stopOpacity="1" />
                    <Stop offset="1" stopColor="#151515" stopOpacity="0" />
                  </SvgLinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="60" fill="url(#fadeTopGrad)" />
              </Svg>
            </View>

            {/* Bottom Fade Gradient */}
            <View style={styles.fadeBottom} pointerEvents="none">
              <Svg height={60} width="100%">
                <Defs>
                  <SvgLinearGradient id="fadeBottomGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor="#151515" stopOpacity="0" />
                    <Stop offset="1" stopColor="#151515" stopOpacity="1" />
                  </SvgLinearGradient>
                </Defs>
                <Rect x="0" y="0" width="100%" height="60" fill="url(#fadeBottomGrad)" />
              </Svg>
            </View>
          </View>

          {/* Selected Preview Badge */}
          <View style={styles.demoOutput}>
            <Text style={styles.demoOutputText}>Selected: {previewTime}</Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.btn, styles.secondaryBtn]} onPress={onCancel} activeOpacity={0.7}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, styles.doneBtn]} onPress={handleConfirm} activeOpacity={0.7}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// Backward-compatibility alias
export const AnalogTimePickerModal = ScrollTimePickerModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  timePickerContainer: {
    width: 320,
    maxWidth: '92%',
    backgroundColor: '#151515',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#262626',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  headerTitle: {
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '600',
    color: '#9aa0a6',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  maxTimeNotice: {
    textAlign: 'center',
    fontSize: 11,
    color: '#f28b82',
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  wheelArea: {
    position: 'relative',
    height: WHEEL_H,
    marginVertical: 6,
  },
  selectionWindow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: PAD_H,
    height: ITEM_H,
    backgroundColor: 'rgba(138, 180, 248, 0.10)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(138, 180, 248, 0.35)',
    borderRadius: 10,
    zIndex: 1,
  },
  columnsRow: {
    flexDirection: 'row',
    height: '100%',
    zIndex: 2,
  },
  column: {
    flex: 1,
    height: '100%',
  },
  separatorContainer: {
    width: 14,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
  },
  separatorText: {
    color: '#8ab4f8',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  itemRow: {
    height: ITEM_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  fadeTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 60,
    zIndex: 4,
  },
  fadeBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
    zIndex: 4,
  },
  demoOutput: {
    marginVertical: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    alignItems: 'center',
  },
  demoOutputText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8ab4f8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 8,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
  },
  secondaryBtnText: {
    color: '#9aa0a6',
    fontSize: 14,
    fontWeight: '500',
  },
  doneBtn: {
    backgroundColor: 'rgba(138, 180, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(138, 180, 248, 0.4)',
  },
  doneBtnText: {
    color: '#8ab4f8',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
