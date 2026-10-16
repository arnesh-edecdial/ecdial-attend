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

export interface EmployeeScheduleItem {
  id?: string;
  employeeId: string;
  dayOfWeek: number;
  dayName?: string;
  startTime: string;
  endTime: string;
  isWorkingDay: boolean;
}

export interface AttendanceTodayData {
  date: string;
  displayStatus: string;
  attendance: {
    id: string;
    date: string;
    checkInTime: string | null;
    checkInFormatted: string | null;
    checkOutTime: string | null;
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
  otStatus: string | null;
}

export interface DashboardData {
  date: string;
  summary: {
    present: number;
    absent: number;
    pending: number;
    incomplete: number;
    otPending: number;
    totalEmployees: number;
  };
  employees: Array<{
    id: string;
    employeeCode: string;
    name: string;
    role: Role;
    department: string;
    checkIn: string | null;
    checkOut: string | null;
    duration: string | null;
    status: string;
    ot: string | null;
    otStatus: string | null;
    schedule: string;
  }>;
}

export interface ApprovalItem {
  id: string;
  type: 'ATTENDANCE_REQUEST' | 'MULTI_DAY_REQUEST' | 'CHECKOUT_CORRECTION' | 'OVERTIME';
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  role: Role;
  dates: string[];
  datesFormatted: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  otFormatted?: string | null;
  otMinutes?: number;
  reason: string;
  remarks?: string;
  submittedAt: string;
}

export interface ProductItem {
  id: string;
  name: string;
  model?: string | null;
  category: 'MAIN_UNIT' | 'LOW_SIDE';
  acType?: string;
  description: string;
  defaultUnit: string;
  defaultPrice: number;
  defaultSupplyRate?: number;
  defaultInstallRate?: number;
  availableStock: number;
  isActive: boolean;
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
  supplyRate?: number;
  supplyAmount?: number;
  installRate?: number;
  installAmount?: number;
  brand?: string | null;
  notes?: string;
}

export interface QuotationPreset {
  id: string;
  title: string;
  presetType: 'TERMS' | 'PAYMENT' | 'SCOPE' | 'REQUIREMENTS' | string;
  acType: string;
  quotationType: string;
  content: string;
  metadata?: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface CustomerItem {
  id: string;
  name?: string | null;
  address?: string | null;
  mobile?: string | null;
  email?: string | null;
  notes?: string | null;
  createdAt?: string;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  revisionNumber: number;
  date: string;
  validTill?: string;
  acType?: 'SPLIT' | 'CASSETTE' | 'DUCT' | 'VRV' | string;
  quotationType?: 'DAIKIN' | 'ECDIAL' | string;
  customerName: string;
  customerAddress: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerLocation?: string | null;
  systemDesignation?: string | null;
  totalCapacity?: string | null;
  offerType?: string | null;
  scopeExclusions?: string | null;
  commissioningReqs?: string | null;
  createdById: string;
  createdByName?: string;
  hasLowSide: boolean;
  mainUnitTotal: number;
  lowSideSupplyTotal?: number;
  lowSideInstallTotal?: number;
  lowSideTotal: number;
  subtotal: number;
  cgstPercent: number;
  cgstAmount: number;
  sgstPercent: number;
  sgstAmount: number;
  grandTotal: number;
  termsAndConditions: string;
  paymentMethod: string;
  status: 'DRAFT' | 'FINAL' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  notes?: string;
  itemsCount?: number;
  createdAt: string;
  items?: QuotationItem[];
}
