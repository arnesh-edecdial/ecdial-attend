export type Role = 'TECHNICIAN' | 'SALES' | 'MANAGER' | 'ACCOUNTANT' | 'ADMIN' | 'IT_ADMIN';

export interface UserDTO {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
  department?: string | null;
  isActive: boolean;
}

export interface EmployeeScheduleItem {
  id?: string;
  employeeId: string;
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  startTime: string; // "09:00"
  endTime: string;   // "20:00"
  isWorkingDay: boolean;
}

export interface GovernmentHolidayDTO {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  description?: string | null;
}

export interface OfficeConfigDTO {
  id: string;
  officeName: string;
  latitude: number;
  longitude: number;
  allowedRadiusMeters: number;
  qrRotationSeconds: number;
  isDefault: boolean;
}

export interface CheckInPayload {
  qrToken: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp?: number;
}

export interface CheckOutPayload {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  timestamp?: number;
}

export interface AttendanceRequestPayload {
  requestType: 'CHECKIN_FAILURE' | 'CHECKOUT_CORRECTION' | 'MULTI_DAY_MISSED';
  dates: string[]; // ['2026-08-18', '2026-08-19']
  checkInTime?: string; // "09:00"
  checkOutTime?: string; // "18:00"
  reason: string;
  remarks?: string;
}

export interface QuotationItemInput {
  id?: string;
  section: 'MAIN_UNIT' | 'LOW_SIDE';
  productId?: string | null;
  itemOrder: number;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
}

export interface QuotationCreatePayload {
  customerName: string;
  customerAddress: string;
  customerPhone?: string;
  customerEmail?: string;
  customerLocation?: string;
  hasLowSide: boolean;
  items: QuotationItemInput[];
  cgstPercent?: number;
  sgstPercent?: number;
  termsAndConditions?: string;
  paymentMethod?: string;
  status?: 'DRAFT' | 'FINAL' | 'SENT';
}
