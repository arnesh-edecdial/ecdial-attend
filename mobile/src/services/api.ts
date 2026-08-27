import { Platform } from 'react-native';
import Constants from 'expo-constants';

// --------------------------------------------------------------------------
// PRODUCTION CLOUD API URL (Paste your Railway / Render / Live URL here)
// Example: export const PRODUCTION_API_URL = 'https://ecdial-backend.up.railway.app/api';
// Leave as empty string '' to auto-detect local computer Wi-Fi IP for testing.
// --------------------------------------------------------------------------
export const PRODUCTION_API_URL: string = '';

function getApiBaseUrl(): string {
  // 1. If a production cloud URL is specified, always use it
  if (PRODUCTION_API_URL && PRODUCTION_API_URL.trim().length > 0) {
    return PRODUCTION_API_URL.trim();
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:4000/api';
  }

  // 2. Extract host IP from Expo debugger host (e.g. 192.168.151.50:8081 -> 192.168.151.50:4000)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost;

  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:4000/api`;
    }
  }

  return 'http://192.168.151.50:4000/api';
}

let activeToken: string | null = null;
let activeEmployeeId = 'usr-admin-1';

export function setAuthToken(token: string | null) {
  activeToken = token;
}

export function getAuthToken() {
  return activeToken;
}

export function setActiveEmployeeId(id: string) {
  activeEmployeeId = id;
}

export function getActiveEmployeeId() {
  return activeEmployeeId;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
    'x-employee-id': activeEmployeeId,
    ...(options.headers as Record<string, string> || {}),
  };

  let response: Response;
  try {
    const url = `${getApiBaseUrl()}${endpoint}`;
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (netErr: any) {
    const netError: any = new Error('Unable to connect to Ecdial backend. Please verify your phone is on the same Wi-Fi network.');
    netError.errorType = 'NETWORK_ERROR';
    throw netError;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error: any = new Error(data?.message || `Request failed (${response.status})`);
    error.errorType = data?.errorType || 'API_ERROR';
    throw error;
  }

  return data;
}

export const mobileApi = {
  // Authentication & Employee Lifecycle
  login: (payload: { email?: string; employeeCode?: string; password: string }) =>
    request<any>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  getMe: () => request<any>('/auth/me'),
  listEmployees: () => request<any>('/auth/employees'),
  createEmployee: (payload: any) =>
    request<any>('/auth/employees', { method: 'POST', body: JSON.stringify(payload) }),
  updateEmployee: (id: string, payload: any) =>
    request<any>(`/auth/employees/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  toggleEmployeeStatus: (id: string) =>
    request<any>(`/auth/employees/${id}/toggle-status`, { method: 'PATCH' }),

  // Attendance
  getTodayQR: () => request<any>('/attendance/qr/today'),
  getTodayStatus: (empId?: string) => request<any>(`/attendance/status/today${empId ? `?employeeId=${empId}` : ''}`),
  getTodayDashboard: (date?: string, status?: string, role?: string) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (status) params.append('status', status);
    if (role) params.append('role', role);
    return request<any>(`/attendance/dashboard/today?${params.toString()}`);
  },
  checkIn: (payload: { qrToken: string; latitude: number; longitude: number; accuracy: number }) =>
    request<any>('/attendance/checkin', { method: 'POST', body: JSON.stringify(payload) }),
  checkOut: (payload?: { latitude?: number; longitude?: number; accuracy?: number }) =>
    request<any>('/attendance/checkout', { method: 'POST', body: JSON.stringify(payload || {}) }),
  submitRequest: (payload: any) =>
    request<any>('/attendance/requests', { method: 'POST', body: JSON.stringify(payload) }),
  getCalendar: (empId?: string, year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (empId) params.append('employeeId', empId);
    if (year) params.append('year', String(year));
    if (month) params.append('month', String(month));
    return request<any>(`/attendance/calendar?${params.toString()}`);
  },

  // Approvals & Calendar Management
  listApprovals: () => request<any>('/attendance/approvals'),
  processApproval: (id: string, action: 'APPROVE' | 'REJECT', remarks?: string, checkInTime?: string, checkOutTime?: string) =>
    request<any>(`/attendance/approvals/${id}`, {
      method: 'POST',
      body: JSON.stringify({ action, remarks, approvedCheckInTime: checkInTime, approvedCheckOutTime: checkOutTime }),
    }),
  directResolveAttendance: (payload: {
    employeeId: string;
    date: string;
    status: string;
    checkInTime?: string;
    checkOutTime?: string;
    remarks?: string;
  }) =>
    request<any>('/attendance/direct-resolve', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listHolidays: () => request<any>('/attendance/holidays'),
  createHoliday: (payload: { date: string; name: string; description?: string }) =>
    request<any>('/attendance/holidays', { method: 'POST', body: JSON.stringify(payload) }),
  deleteHoliday: (id: string) => request<any>(`/attendance/holidays/${id}`, { method: 'DELETE' }),

  // Catalog & Machines
  listProducts: (category?: string, search?: string, activeOnly?: boolean) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    if (activeOnly) params.append('activeOnly', 'true');
    return request<any>(`/catalog/products?${params.toString()}`);
  },
  createMachine: (payload: any) =>
    request<any>('/catalog/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateMachine: (id: string, payload: any) =>
    request<any>(`/catalog/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  toggleMachine: (id: string) =>
    request<any>(`/catalog/products/${id}/toggle`, { method: 'PATCH' }),
  deleteMachine: (id: string) =>
    request<any>(`/catalog/products/${id}`, { method: 'DELETE' }),

  // Quotations
  createQuotation: (payload: any) =>
    request<any>('/quotations', { method: 'POST', body: JSON.stringify(payload) }),
  listQuotations: (createdBy?: string, status?: string) => {
    const params = new URLSearchParams();
    if (createdBy) params.append('createdBy', createdBy);
    if (status) params.append('status', status);
    return request<any>(`/quotations?${params.toString()}`);
  },
  getQuotation: (id: string) => request<any>(`/quotations/${id}`),
  getQuotationById: (id: string) => request<any>(`/quotations/${id}`),
  updateQuotation: (id: string, payload: any) =>
    request<any>(`/quotations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  getPdfUrl: (id: string) => `${getApiBaseUrl()}/quotations/${id}/pdf`,
};
