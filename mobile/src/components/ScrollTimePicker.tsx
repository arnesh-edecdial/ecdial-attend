import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import Svg, { Polyline, Circle, Line, Path } from 'react-native-svg';

import {
  pad,
  computeHour24,
  parse24HourString,
  formatTime12,
  formatTime24,
} from '../utils/time';

export {
  computeHour24,
  parse24HourString,
  formatTime12,
  formatTime24,
};

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface TimePickerValue {
  hour12: number;
  minute: number;
  period: 'AM' | 'PM';
  hour24: number;
  formatted24: string;
  formatted12: string;
}

export interface SteppedTimePickerProps {
  initialTime?: string;
  initialHour?: number;
  initialMinute?: number;
  initialPeriod?: 'AM' | 'PM';
  title?: string;
  subtitle?: string;
  maxTime?: { hour24: number; minute: number };
  minTime?: { hour24: number; minute: number };
  onConfirm: (time: TimePickerValue) => void;
  onCancel?: () => void;
  onReset?: () => void;
}

export interface ScrollTimePickerModalProps extends SteppedTimePickerProps {
  visible: boolean;
  onCancel: () => void;
}

const ACCENT = '#3E63F5';
const ACCENT_LIGHT = '#EDF1FE';
const BORDER = '#E5E8EF';
const TEXT_MUTED = '#8C93A3';
const TEXT_DARK = '#1C2130';

// ─────────────────────────────────────────────
// SMALL ICONS (inline SVG, no extra deps)
// ─────────────────────────────────────────────

const ChevronUpIcon = ({ color = TEXT_DARK }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Polyline
      points="6 15 12 9 18 15"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const ChevronDownIcon = ({ color = TEXT_DARK }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Polyline
      points="6 9 12 15 18 9"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const ClockIcon = ({ color = '#FFFFFF' }: { color?: string }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={2} />
    <Line x1="12" y1="7" x2="12" y2="12.5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <Line x1="12" y1="12.5" x2="15.2" y2="14" stroke={color} strokeWidth={2} strokeLinecap="round" />
  </Svg>
);

const CloseIcon = ({ color = TEXT_MUTED }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
  </Svg>
);

const EyeIcon = ({ color = ACCENT }: { color?: string }) => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
    <Path
      d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"
      stroke={color}
      strokeWidth={2}
      strokeLinejoin="round"
    />
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={2} />
  </Svg>
);

const ResetIcon = ({ color = TEXT_MUTED }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Path
      d="M20 11A8 8 0 1 0 18.5 16"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
    />
    <Polyline
      points="20 5 20 11 14 11"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const CheckIcon = ({ color = '#FFFFFF' }: { color?: string }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
    <Polyline
      points="20 6 9 17 4 12"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// ─────────────────────────────────────────────
// INITIAL TIME RESOLUTION
// ─────────────────────────────────────────────

function resolveInitialState(props: {
  initialTime?: string;
  initialHour?: number;
  initialMinute?: number;
  initialPeriod?: 'AM' | 'PM';
  maxTime?: { hour24: number; minute: number };
  minTime?: { hour24: number; minute: number };
}): { hour: number; minute: number; period: 'AM' | 'PM' } {
  let h = 12;
  let m = 0;
  let p: 'AM' | 'PM' = 'AM';

  if (
    props.initialTime &&
    typeof props.initialTime === 'string' &&
    props.initialTime.includes(':')
  ) {
    const parsed = parse24HourString(props.initialTime);
    h = parsed.hour12;
    m = parsed.minute;
    p = parsed.period;
  } else if (props.initialHour !== undefined) {
    h = props.initialHour;
    m = props.initialMinute ?? 0;
    p = props.initialPeriod || (h >= 12 ? 'PM' : 'AM');
  } else {
    const now = new Date();
    const parsed = parse24HourString(now);
    h = parsed.hour12;
    m = parsed.minute;
    p = parsed.period;
  }

  if (props.maxTime) {
    const totalMins = computeHour24(h, p) * 60 + m;
    const maxMins = props.maxTime.hour24 * 60 + props.maxTime.minute;

    if (totalMins > maxMins) {
      p = props.maxTime.hour24 >= 12 ? 'PM' : 'AM';
      let clampedH12 = props.maxTime.hour24 % 12;
      if (clampedH12 === 0) clampedH12 = 12;
      h = clampedH12;
      m = props.maxTime.minute;
    }
  }

  if (props.minTime) {
    const totalMins = computeHour24(h, p) * 60 + m;
    const minMins = props.minTime.hour24 * 60 + props.minTime.minute;

    if (totalMins < minMins) {
      p = props.minTime.hour24 >= 12 ? 'PM' : 'AM';
      let clampedH12 = props.minTime.hour24 % 12;
      if (clampedH12 === 0) clampedH12 = 12;
      h = clampedH12;
      m = props.minTime.minute;
    }
  }

  return { hour: h, minute: m, period: p };
}

// ─────────────────────────────────────────────
// STEPPER FIELD (hour or minute column)
// ─────────────────────────────────────────────

interface StepperFieldProps {
  label: string;
  value: number;
  displayValue: string;
  onIncrement: () => void;
  onDecrement: () => void;
  incrementDisabled: boolean;
  decrementDisabled: boolean;
}

// Delay before fast-forward kicks in (ms)
const HOLD_DELAY_MS = 400;
// Interval between fast-forward steps (ms)
const HOLD_INTERVAL_MS = 100;

const StepperField: React.FC<StepperFieldProps> = ({
  label,
  displayValue,
  onIncrement,
  onDecrement,
  incrementDisabled,
  decrementDisabled,
}) => {
  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearHold = () => {
    if (holdTimeout.current) { clearTimeout(holdTimeout.current); holdTimeout.current = null; }
    if (holdInterval.current) { clearInterval(holdInterval.current); holdInterval.current = null; }
  };

  const startHold = (action: () => void, disabled: boolean) => {
    if (disabled) return;
    // Fire immediately on press
    action();
    // After HOLD_DELAY_MS, start repeating at HOLD_INTERVAL_MS
    holdTimeout.current = setTimeout(() => {
      holdInterval.current = setInterval(action, HOLD_INTERVAL_MS);
    }, HOLD_DELAY_MS);
  };

  // Clean up on unmount
  useEffect(() => () => clearHold(), []);

  return (
    <View style={styles.stepperField}>
      <TouchableOpacity
        style={[styles.stepperBtn, incrementDisabled && styles.stepperBtnDisabled]}
        onPressIn={() => startHold(onIncrement, incrementDisabled)}
        onPressOut={clearHold}
        disabled={incrementDisabled}
        activeOpacity={0.6}
      >
        <ChevronUpIcon color={incrementDisabled ? '#C6CAD4' : TEXT_DARK} />
      </TouchableOpacity>

      <Text style={styles.stepperValue}>{displayValue}</Text>

      <TouchableOpacity
        style={[styles.stepperBtn, decrementDisabled && styles.stepperBtnDisabled]}
        onPressIn={() => startHold(onDecrement, decrementDisabled)}
        onPressOut={clearHold}
        disabled={decrementDisabled}
        activeOpacity={0.6}
      >
        <ChevronDownIcon color={decrementDisabled ? '#C6CAD4' : TEXT_DARK} />
      </TouchableOpacity>

      <Text style={styles.stepperLabel}>{label}</Text>
    </View>
  );
};

// ─────────────────────────────────────────────
// STANDALONE STEPPED TIME PICKER COMPONENT
// ─────────────────────────────────────────────

export const SteppedTimePicker: React.FC<SteppedTimePickerProps> = ({
  initialTime,
  initialHour,
  initialMinute,
  initialPeriod,
  title = 'Set Time',
  subtitle = 'Choose a time in 12-hour format',
  maxTime,
  minTime,
  onConfirm,
  onCancel,
  onReset,
}) => {
  const initialValues = useMemo(
    () =>
      resolveInitialState({
        initialTime,
        initialHour,
        initialMinute,
        initialPeriod,
        maxTime,
        minTime,
      }),
    [initialTime, initialHour, initialMinute, initialPeriod, maxTime, minTime]
  );

  const [hour, setHour] = useState<number>(initialValues.hour);
  const [minute, setMinute] = useState<number>(initialValues.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(initialValues.period);

  useEffect(() => {
    const resolved = resolveInitialState({
      initialTime,
      initialHour,
      initialMinute,
      initialPeriod,
      maxTime,
      minTime,
    });
    setHour(resolved.hour);
    setMinute(resolved.minute);
    setPeriod(resolved.period);
  }, [initialTime, initialHour, initialMinute, initialPeriod, maxTime, minTime]);

  const totalMinutesFor = useCallback(
    (h: number, m: number, p: 'AM' | 'PM') => computeHour24(h, p) * 60 + m,
    []
  );

  const maxMins = maxTime ? maxTime.hour24 * 60 + maxTime.minute : null;
  const minMins = minTime ? minTime.hour24 * 60 + minTime.minute : null;

  // ─────────────────────────────────────────────
  // HOUR STEPPING (wraps 1-12, clamped by min/max)
  // ─────────────────────────────────────────────

  const stepHour = (direction: 1 | -1) => {
    let nextHour = hour + direction;
    if (nextHour > 12) nextHour = 1;
    if (nextHour < 1) nextHour = 12;

    let nextMinute = minute;
    const candidateMins = totalMinutesFor(nextHour, nextMinute, period);

    if (maxMins !== null && candidateMins > maxMins) {
      if (totalMinutesFor(nextHour, 0, period) > maxMins) return;
      nextMinute = maxTime!.minute;
    }

    if (minMins !== null && candidateMins < minMins) {
      if (totalMinutesFor(nextHour, 59, period) < minMins) return;
      nextMinute = minTime!.minute;
    }

    setHour(nextHour);
    setMinute(nextMinute);
  };

  // ─────────────────────────────────────────────
  // MINUTE STEPPING (wraps 0-59, clamped by min/max)
  // ─────────────────────────────────────────────

  const stepMinute = (direction: 1 | -1) => {
    let nextMinute = minute + direction;
    if (nextMinute > 59) nextMinute = 0;
    if (nextMinute < 0) nextMinute = 59;

    const candidateMins = totalMinutesFor(hour, nextMinute, period);

    if (maxMins !== null && candidateMins > maxMins) return;
    if (minMins !== null && candidateMins < minMins) return;

    setMinute(nextMinute);
  };

  // ─────────────────────────────────────────────
  // PERIOD SELECTION
  // ─────────────────────────────────────────────

  const isPeriodDisabled = useCallback(
    (p: 'AM' | 'PM') => {
      if (maxTime && p === 'PM' && maxTime.hour24 < 12) return true;
      if (minTime && p === 'AM' && minTime.hour24 >= 12) return true;
      return false;
    },
    [maxTime, minTime]
  );

  const handlePeriodChange = (newPeriod: 'AM' | 'PM') => {
    if (isPeriodDisabled(newPeriod)) return;
    setPeriod(newPeriod);

    const candidateMins = totalMinutesFor(hour, minute, newPeriod);

    if (maxMins !== null && candidateMins > maxMins) {
      let clampedH12 = maxTime!.hour24 % 12;
      if (clampedH12 === 0) clampedH12 = 12;
      setHour(clampedH12);
      setMinute(maxTime!.minute);
    }

    if (minMins !== null && candidateMins < minMins) {
      let clampedH12 = minTime!.hour24 % 12;
      if (clampedH12 === 0) clampedH12 = 12;
      setHour(clampedH12);
      setMinute(minTime!.minute);
    }
  };

  // Stepper boundary disable states
  const isHourIncrementDisabled = useMemo(() => {
    if (maxMins === null) return false;
    let nextHour = hour + 1;
    if (nextHour > 12) nextHour = 1;
    return totalMinutesFor(nextHour, 0, period) > maxMins;
  }, [hour, period, maxMins, totalMinutesFor]);

  const isHourDecrementDisabled = useMemo(() => {
    if (minMins === null) return false;
    let nextHour = hour - 1;
    if (nextHour < 1) nextHour = 12;
    return totalMinutesFor(nextHour, 59, period) < minMins;
  }, [hour, period, minMins, totalMinutesFor]);

  const isMinuteIncrementDisabled = useMemo(() => {
    if (maxMins === null) return false;
    let nextMinute = minute + 1;
    if (nextMinute > 59) nextMinute = 0;
    return totalMinutesFor(hour, nextMinute, period) > maxMins;
  }, [hour, minute, period, maxMins, totalMinutesFor]);

  const isMinuteDecrementDisabled = useMemo(() => {
    if (minMins === null) return false;
    let nextMinute = minute - 1;
    if (nextMinute < 0) nextMinute = 59;
    return totalMinutesFor(hour, nextMinute, period) < minMins;
  }, [hour, minute, period, minMins, totalMinutesFor]);

  // ─────────────────────────────────────────────
  // RESET / CONFIRM
  // ─────────────────────────────────────────────

  const handleReset = () => {
    setHour(initialValues.hour);
    setMinute(initialValues.minute);
    setPeriod(initialValues.period);
    onReset?.();
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

  const previewTime = `${pad(hour)}:${pad(minute)} ${period}`;

  return (
    <View style={styles.card}>
      {/* HEADER */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconCircle}>
            <ClockIcon />
          </View>
          <View style={styles.headerTextGroup}>
            <Text style={styles.headerTitle}>{title}</Text>
            <Text style={styles.headerSubtitle}>{subtitle}</Text>
          </View>
        </View>

        {onCancel && (
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onCancel}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <CloseIcon />
          </TouchableOpacity>
        )}
      </View>

      {/* OPTIONAL MAX/MIN LIMIT INFO */}
      {maxTime && (
        <Text style={styles.limitNotice}>
          Max allowed: {formatTime12(`${pad(maxTime.hour24)}:${pad(maxTime.minute)}`)}
        </Text>
      )}

      {/* STEPPERS */}
      <View style={styles.steppersRow}>
        <StepperField
          label="Hours"
          value={hour}
          displayValue={pad(hour)}
          onIncrement={() => stepHour(1)}
          onDecrement={() => stepHour(-1)}
          incrementDisabled={isHourIncrementDisabled}
          decrementDisabled={isHourDecrementDisabled}
        />

        <Text style={styles.colonText}>:</Text>

        <StepperField
          label="Minutes"
          value={minute}
          displayValue={pad(minute)}
          onIncrement={() => stepMinute(1)}
          onDecrement={() => stepMinute(-1)}
          incrementDisabled={isMinuteIncrementDisabled}
          decrementDisabled={isMinuteDecrementDisabled}
        />

        <View style={styles.periodGroup}>
          {(['AM', 'PM'] as const).map((p) => {
            const selected = period === p;
            const disabled = isPeriodDisabled(p);

            return (
              <TouchableOpacity
                key={p}
                style={[
                  styles.periodBtn,
                  selected && styles.periodBtnSelected,
                  disabled && styles.periodBtnDisabled,
                ]}
                onPress={() => handlePeriodChange(p)}
                disabled={disabled}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.periodBtnText,
                    selected && styles.periodBtnTextSelected,
                    disabled && styles.periodBtnTextDisabled,
                  ]}
                >
                  {p}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* SELECTED TIME PREVIEW */}
      <View style={styles.previewBox}>
        <View style={styles.previewLabelRow}>
          <EyeIcon />
          <Text style={styles.previewLabel}>Selected Time</Text>
        </View>
        <Text style={styles.previewValue}>{previewTime}</Text>
      </View>

      {/* ACTIONS */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.resetBtn}
          onPress={handleReset}
          activeOpacity={0.7}
        >
          <ResetIcon />
          <Text style={styles.resetBtnText}>Reset</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.confirmBtn}
          onPress={handleConfirm}
          activeOpacity={0.85}
        >
          <CheckIcon />
          <Text style={styles.confirmBtnText}>Confirm Time</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────
// MODAL PRESENTATION WRAPPER
// ─────────────────────────────────────────────

export const ScrollTimePickerModal: React.FC<ScrollTimePickerModalProps> = ({
  visible,
  onCancel,
  ...pickerProps
}) => {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={onCancel}
        />
        <View style={styles.modalCardWrapper}>
          <SteppedTimePicker
            {...pickerProps}
            onCancel={onCancel}
          />
        </View>
      </View>
    </Modal>
  );
};

// Backward-compatibility aliases
export const AnalogTimePickerModal = ScrollTimePickerModal;
export default ScrollTimePickerModal;

// ─────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },

  modalCardWrapper: {
    width: '100%',
    maxWidth: 390,
    zIndex: 10,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 20,
    shadowColor: '#1C2130',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  headerTextGroup: {
    flexShrink: 1,
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: TEXT_DARK,
  },

  headerSubtitle: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
  },

  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  limitNotice: {
    fontSize: 11.5,
    color: '#E05638',
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },

  steppersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  stepperField: {
    alignItems: 'center',
  },

  stepperBtn: {
    width: 46,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  stepperBtnDisabled: {
    backgroundColor: '#F5F6F9',
  },

  stepperValue: {
    fontSize: 30,
    fontWeight: '700',
    color: TEXT_DARK,
    fontVariant: ['tabular-nums'],
    marginVertical: 4,
    minWidth: 56,
    textAlign: 'center',
  },

  stepperLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 4,
  },

  colonText: {
    fontSize: 26,
    fontWeight: '700',
    color: TEXT_DARK,
    marginHorizontal: 12,
    marginTop: -20,
  },

  periodGroup: {
    marginLeft: 18,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
  },

  periodBtn: {
    width: 60,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  periodBtnSelected: {
    backgroundColor: ACCENT,
  },

  periodBtnDisabled: {
    backgroundColor: '#F5F6F9',
  },

  periodBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_DARK,
  },

  periodBtnTextSelected: {
    color: '#FFFFFF',
  },

  periodBtnTextDisabled: {
    color: '#C6CAD4',
  },

  previewBox: {
    backgroundColor: ACCENT_LIGHT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 18,
  },

  previewLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },

  previewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5C6478',
  },

  previewValue: {
    fontSize: 26,
    fontWeight: '800',
    color: ACCENT,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },

  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#FFFFFF',
  },

  resetBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
    color: TEXT_MUTED,
  },

  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: ACCENT,
  },

  confirmBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
