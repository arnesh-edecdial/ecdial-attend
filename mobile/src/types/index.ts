export type Role = 'TECHNICIAN' | 'SALES' | 'MANAGER' | 'ACCOUNTANT' | 'ADMIN' | 'IT_ADMIN';

export interface User {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  department?: string | null;
}

export interface TodayAttendanceStatus {
  date: string;
  displayStatus: 'NOT_MARKED' | 'PRESENT' | 'CHECKED_IN' | 'COMPLETED' | 'WAITING_FOR_APPROVAL' | 'HOLIDAY' | 'COMPANY_LEAVE' | 'WEEKLY_OFF';
  attendance: {
    id: string;
    checkInFormatted: string | null;
    checkOutFormatted: string | null;
    durationFormatted: string | null;
    status: string;
    otMinutes: number;
    otStatus: string;
    notes?: string;
  } | null;
  holiday: { name: string; description?: string } | null;
  isWeeklyOff: boolean;
  schedule: { startTime: string; endTime: string; isWorkingDay: boolean } | null;
  office: { officeName: string; allowedRadiusMeters: number } | null;
}

export interface CalendarDay {
  date: string;
  dayNumber: number;
  dayOfWeek: number;
  dayName: string;
  status: string;
  colorCode: 'GREEN' | 'RED' | 'YELLOW' | 'PURPLE' | 'GREY';
  badge: string;
  holidayName: string | null;
  checkIn: string | null;
  checkOut: string | null;
  workingDuration: string | null;
  otFormatted: string | null;
  isCompanyLeave?: boolean;
}

export interface QuotationItem {
  id?: string;
  section: 'MAIN_UNIT' | 'LOW_SIDE';
  productId?: string | null;
  itemOrder: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  revisionNumber: number;
  date: string;
  customerName: string;
  customerAddress: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  hasLowSide: boolean;
  mainUnitTotal: number;
  lowSideTotal: number;
  subtotal: number;
  cgstPercent: number;
  cgstAmount: number;
  sgstPercent: number;
  sgstAmount: number;
  grandTotal: number;
  termsAndConditions: string;
  paymentMethod: string;
  status: string;
  createdById?: string | null;
  createdByName?: string | null;
  items?: QuotationItem[];
}
