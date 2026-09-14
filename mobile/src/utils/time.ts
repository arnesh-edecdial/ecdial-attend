/**
 * Canonical Time Utilities for Mobile
 * Provides consistent 12-hour formatting for all UI displays (e.g. "09:00 AM", "01:30 PM", "12:00 AM")
 * and 24-hour formatting for backend API payloads (e.g. "09:00", "13:30").
 */

export function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Compute 24-hour number (0-23) from 12-hour number (1-12) and AM/PM
 */
export function computeHour24(h12: number, period: 'AM' | 'PM'): number {
  const norm = h12 % 12;
  return period === 'AM' ? norm : norm + 12;
}

/**
 * Parses any time string or Date into 12h/24h components.
 * Handles:
 * - "09:00", "13:30", "0:0", "23:59"
 * - "09:00 AM", "1:30 pm"
 * - ISO string: "2026-09-12T09:30:00.000Z"
 * - Date object
 */
export function parse24HourString(timeStr?: string | Date | null): {
  hour12: number;
  minute: number;
  period: 'AM' | 'PM';
  hour24: number;
} {
  if (!timeStr) {
    const now = new Date();
    const h24 = now.getHours();
    const m = now.getMinutes();
    const p: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return { hour12: h12, minute: m, period: p, hour24: h24 };
  }

  if (timeStr instanceof Date) {
    const h24 = timeStr.getHours();
    const m = timeStr.getMinutes();
    const p: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return { hour12: h12, minute: m, period: p, hour24: h24 };
  }

  const str = String(timeStr).trim();

  // Check if it is an ISO Date string with 'T'
  if (str.includes('T')) {
    try {
      const d = new Date(str);
      if (!isNaN(d.getTime())) {
        // Render in IST / local time
        const hoursStr = d.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
        });
        const [hStr, mStr] = hoursStr.split(':');
        const h24 = parseInt(hStr, 10) || 0;
        const m = parseInt(mStr, 10) || 0;
        const p: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
        let h12 = h24 % 12;
        if (h12 === 0) h12 = 12;
        return { hour12: h12, minute: m, period: p, hour24: h24 };
      }
    } catch {
      // Fallback below
    }
  }

  // Check if it contains AM/PM
  const match12 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (match12) {
    let h = parseInt(match12[1], 10) || 0;
    const m = Math.max(0, Math.min(59, parseInt(match12[2], 10) || 0));
    const periodParam = match12[3]?.toUpperCase();

    if (periodParam === 'PM' || periodParam === 'AM') {
      const p: 'AM' | 'PM' = periodParam as 'AM' | 'PM';
      let h12 = h % 12;
      if (h12 === 0) h12 = 12;
      const h24 = computeHour24(h12, p);
      return { hour12: h12, minute: m, period: p, hour24: h24 };
    }

    // Pure 24h string e.g. "09:00", "13:30", "00:00"
    const validH24 = Math.max(0, Math.min(23, h));
    const p: 'AM' | 'PM' = validH24 >= 12 ? 'PM' : 'AM';
    let h12 = validH24 % 12;
    if (h12 === 0) h12 = 12;
    return { hour12: h12, minute: m, period: p, hour24: validH24 };
  }

  // Final fallback: deterministic current time
  const now = new Date();
  const h24 = now.getHours();
  const m = now.getMinutes();
  const p: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return { hour12: h12, minute: m, period: p, hour24: h24 };
}

/**
 * Format any time to 12-hour string with AM/PM (e.g. "09:00 AM", "01:30 PM", "12:00 AM", "12:00 PM")
 */
export function formatTime12(time?: string | Date | null): string {
  if (!time || time === '—' || time === '--:--' || time === 'null' || time === 'undefined') {
    return '—';
  }

  try {
    const parsed = parse24HourString(time);
    return `${pad(parsed.hour12)}:${pad(parsed.minute)} ${parsed.period}`;
  } catch {
    return '—';
  }
}

/**
 * Format 12-hour components to 24-hour "HH:mm" string for API payloads (e.g. "09:00", "13:30")
 */
export function formatTime24(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  const h24 = computeHour24(hour12, period);
  return `${pad(h24)}:${pad(minute)}`;
}

/**
 * Formats a schedule string like "09:00 - 18:00" or "09:00-20:00" to 12-hour format:
 * "09:00 AM - 06:00 PM"
 */
export function formatSchedule12(scheduleStr?: string | null): string {
  if (!scheduleStr || scheduleStr === '—') return '—';
  const parts = scheduleStr.split(/\s*-\s*|\s*to\s*/i);
  if (parts.length === 2) {
    const startFormatted = formatTime12(parts[0]);
    const endFormatted = formatTime12(parts[1]);
    if (startFormatted !== '—' && endFormatted !== '—') {
      return `${startFormatted} - ${endFormatted}`;
    }
  }
  return formatTime12(scheduleStr);
}
