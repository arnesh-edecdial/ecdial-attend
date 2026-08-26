import { Platform } from 'react-native';

// Standard local IP or localhost for React Native simulators / dev clients
const API_BASE = Platform.OS === 'android' ? 'http://10.0.2.2:4000/api' : 'http://localhost:4000/api';

let activeEmployeeId = 'usr-tech-1'; // Default active persona for mobile is Field Technician

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
    const response = await fetch(`${API_BASE}${endpoint}`, {
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
      // User-friendly network failure
      const netError: any = new Error('Unable to connect to Ecdial. Please check your connection and try again.');
      netError.errorType = 'NETWORK_ERROR';
      throw netError;
    }
    throw err;
  }
}

export const mobileApi = {
  getTodayStatus: (empId?: string) => request<any>(`/attendance/status/today${empId ? `?employeeId=${empId}` : ''}`),
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
  listProducts: (category?: string, search?: string) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    return request<any>(`/catalog/products?${params.toString()}`);
  },
  createQuotation: (payload: any) =>
    request<any>('/quotations', { method: 'POST', body: JSON.stringify(payload) }),
  listQuotations: () => request<any>('/quotations'),
  getQuotationById: (id: string) => request<any>(`/quotations/${id}`),
};
