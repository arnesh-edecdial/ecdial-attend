const API_BASE = '/api';

export class ApiError extends Error {
  errorType?: string;
  constructor(message: string, errorType?: string) {
    super(message);
    this.errorType = errorType;
  }
}

let activeEmployeeId = 'usr-admin-1'; // Default active user for dev/demo

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

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.message || `Request failed with status ${response.status}`;
    throw new ApiError(errorMsg, data?.errorType);
  }

  return data;
}

export const api = {
  // Auth & Employees
  getCurrentUser: () => request<any>('/auth/me'),
  listEmployees: () => request<any>('/auth/employees'),

  // Attendance
  getTodayQR: () => request<any>('/attendance/qr/today'),
  getTodayStatus: (employeeId?: string) =>
    request<any>(`/attendance/status/today${employeeId ? `?employeeId=${employeeId}` : ''}`),
  checkIn: (payload: { qrToken: string; latitude: number; longitude: number; accuracy: number }) =>
    request<any>('/attendance/checkin', { method: 'POST', body: JSON.stringify(payload) }),
  checkOut: (payload?: { latitude?: number; longitude?: number; accuracy?: number }) =>
    request<any>('/attendance/checkout', { method: 'POST', body: JSON.stringify(payload || {}) }),
  submitAttendanceRequest: (payload: any) =>
    request<any>('/attendance/requests', { method: 'POST', body: JSON.stringify(payload) }),
  getMonthlyCalendar: (employeeId?: string, year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (employeeId) params.append('employeeId', employeeId);
    if (year) params.append('year', String(year));
    if (month) params.append('month', String(month));
    return request<any>(`/attendance/calendar?${params.toString()}`);
  },
  getTodayDashboard: (date?: string, role?: string, status?: string, search?: string) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (role) params.append('role', role);
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    return request<any>(`/attendance/dashboard/today?${params.toString()}`);
  },

  // Schedules
  getEmployeeSchedule: (employeeId: string) => request<any>(`/attendance/schedules/${employeeId}`),
  updateEmployeeSchedule: (employeeId: string, schedules: any[]) =>
    request<any>(`/attendance/schedules/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify({ schedules }),
    }),

  // Holidays
  listHolidays: () => request<any>('/attendance/holidays'),
  createHoliday: (data: { date: string; name: string; description?: string }) =>
    request<any>('/attendance/holidays', { method: 'POST', body: JSON.stringify(data) }),
  deleteHoliday: (id: string) => request<any>(`/attendance/holidays/${id}`, { method: 'DELETE' }),

  // Office Config
  getOfficeConfig: () => request<any>('/attendance/office-config'),
  updateOfficeConfig: (config: any) =>
    request<any>('/attendance/office-config', { method: 'PUT', body: JSON.stringify(config) }),

  // Central Approval Queue
  listPendingApprovals: () => request<any>('/attendance/approvals'),
  processApproval: (id: string, action: 'APPROVE' | 'REJECT', remarks?: string) =>
    request<any>(`/attendance/approvals/${id}`, {
      method: 'POST',
      body: JSON.stringify({ action, remarks }),
    }),

  // Audit Logs
  listAuditLogs: (employeeId?: string, action?: string, date?: string) => {
    const params = new URLSearchParams();
    if (employeeId) params.append('employeeId', employeeId);
    if (action) params.append('action', action);
    if (date) params.append('date', date);
    return request<any>(`/attendance/audit-logs?${params.toString()}`);
  },

  // Catalog
  listProducts: (category?: string, search?: string) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    return request<any>(`/catalog/products?${params.toString()}`);
  },

  // Quotations
  getQuotationConfig: () => request<any>('/quotations/config'),
  updateQuotationConfig: (data: any) =>
    request<any>('/quotations/config', { method: 'PUT', body: JSON.stringify(data) }),
  createQuotation: (payload: any) =>
    request<any>('/quotations', { method: 'POST', body: JSON.stringify(payload) }),
  listQuotations: (status?: string, search?: string) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    return request<any>(`/quotations?${params.toString()}`);
  },
  getQuotationById: (id: string) => request<any>(`/quotations/${id}`),
  updateQuotation: (id: string, payload: any) =>
    request<any>(`/quotations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  updateQuotationStatus: (id: string, status: string) =>
    request<any>(`/quotations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getPdfDownloadUrl: (id: string) => `/api/quotations/${id}/pdf`,
};
