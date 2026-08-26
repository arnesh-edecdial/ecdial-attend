export interface FinancialTotals {
  mainUnitTotal: number;
  lowSideTotal: number;
  subtotal: number;
  cgstPercent: number;
  cgstAmount: number;
  sgstPercent: number;
  sgstAmount: number;
  grandTotal: number;
}

/**
 * Standard rounding to 2 decimal places to avoid floating point issues
 */
export function roundCurrency(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Calculate quotation financial totals authoritatively on backend
 */
export function calculateQuotationTotals(
  items: Array<{ section: string; quantity: number; unitPrice: number }>,
  hasLowSide: boolean,
  cgstPercent: number = 9.0,
  sgstPercent: number = 9.0
): FinancialTotals {
  let mainUnitTotal = 0;
  let lowSideTotal = 0;

  for (const item of items) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const itemAmount = roundCurrency(qty * price);

    if (item.section === 'MAIN_UNIT') {
      mainUnitTotal += itemAmount;
    } else if (item.section === 'LOW_SIDE' && hasLowSide) {
      lowSideTotal += itemAmount;
    }
  }

  mainUnitTotal = roundCurrency(mainUnitTotal);
  lowSideTotal = roundCurrency(lowSideTotal);
  const subtotal = roundCurrency(mainUnitTotal + lowSideTotal);

  const cgstAmount = roundCurrency((subtotal * cgstPercent) / 100);
  const sgstAmount = roundCurrency((subtotal * sgstPercent) / 100);
  const grandTotal = roundCurrency(subtotal + cgstAmount + sgstAmount);

  return {
    mainUnitTotal,
    lowSideTotal,
    subtotal,
    cgstPercent,
    cgstAmount,
    sgstPercent,
    sgstAmount,
    grandTotal,
  };
}

/**
 * Calculate duration in minutes between two Date instances
 */
export function calculateDurationMinutes(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60)));
}

/**
 * Format minutes into "Xh Ym" string (e.g. "8h 30m")
 */
export function formatMinutesToDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * Calculate potential overtime from schedule end time
 * e.g., scheduled end: "18:00", actual checkout: 2026-08-25T20:15:00
 */
export function calculateOvertimeMinutes(
  checkOutDate: Date,
  scheduledEndTime: string // "HH:MM"
): number {
  const [endH, endM] = scheduledEndTime.split(':').map(Number);
  const scheduledEnd = new Date(checkOutDate);
  scheduledEnd.setHours(endH, endM, 0, 0);

  if (checkOutDate.getTime() <= scheduledEnd.getTime()) {
    return 0;
  }

  const diffMs = checkOutDate.getTime() - scheduledEnd.getTime();
  return Math.floor(diffMs / (1000 * 60));
}

/**
 * Format time to 12-hour AM/PM string (e.g. "09:04 AM")
 */
export function formatTime12h(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const strMinutes = minutes < 10 ? '0' + minutes : minutes;
  const strHours = hours < 10 ? '0' + hours : hours;
  return `${strHours}:${strMinutes} ${ampm}`;
}

/**
 * Format Date to YYYY-MM-DD
 */
export function getTodayDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
