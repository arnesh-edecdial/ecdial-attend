import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Automatically detect host machine IP when running on Expo Go via Wi-Fi, simulator, or browser
function getApiBaseUrl(): string {
  if (Platform.OS === 'web') {
    return 'http://localhost:4000/api';
  }

  // Extract host IP from Expo debugger host (e.g. 192.168.151.50:8081 -> 192.168.151.50:4000)
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

let activeEmployeeId = 'usr-admin-1'; // Default active persona

export function setActiveEmployeeId(id: string) {
  activeEmployeeId = id;
}

export function getActiveEmployeeId() {
  return activeEmployeeId;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-employee-id': activeEmployeeId,
    ...(options.headers as Record<string, string> || {}),
  };

  try {
    const url = `${getApiBaseUrl()}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const error: any = new Error(data?.message || 'Network request failed');
      error.errorType = data?.errorType;
      throw error;
    }

    return data;
  } catch (err: any) {
    if (!err.errorType) {
      const netError: any = new Error('Unable to connect to Ecdial. Please check your connection and try again.');
      netError.errorType = 'NETWORK_ERROR';
      throw netError;
    }
    throw err;
  }
}

export const mobileApi = {
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
  getQuotationById: (id: string) => request<any>(`/quotations/${id}`),
  updateQuotation: (id: string, payload: any) =>
    request<any>(`/quotations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  getPdfUrl: (id: string) => `${getApiBaseUrl()}/quotations/${id}/pdf`,
};
