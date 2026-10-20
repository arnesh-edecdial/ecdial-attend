/**
 * Where the backend lives.
 *  - local dev  : VITE_API_URL is empty -> '/api', which vite.config.ts proxies to http://localhost:4000
 *  - production : VITE_API_URL=https://ecdial-attend.vercel.app/api  (see .env.production), or leave it empty and
 *                 let the host rewrite /api/* to the backend (vercel.json)
 */
const API_BASE: string = (((import.meta as any).env?.VITE_API_URL as string | undefined) || '/api').replace(/\/+$/, '');
const TOKEN_KEY = 'ecdial_access_token';

export function getAuthToken(): string | null {
  try { return window.localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setAuthToken(token: string | null): void {
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('[ECDIAL Auth] Unable to update saved session.', error);
  }
}

export class ApiError extends Error {
  errorType?: string;
  constructor(message: string, errorType?: string) {
    super(message);
    this.errorType = errorType;
  }
}

let activeEmployeeId: string | null = null;

export function setActiveEmployeeId(id: string) {
  activeEmployeeId = id;
}

export function getActiveEmployeeId() {
  return activeEmployeeId;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(activeEmployeeId ? { 'x-employee-id': activeEmployeeId } : {}),
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
  login: (payload: { email?: string; employeeCode?: string; password: string }) =>
    request<any>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
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
  listProducts: (category?: string, search?: string, acType?: string) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    if (acType) params.append('acType', acType);
    return request<any>(`/catalog/products?${params.toString()}`);
  },
  createProduct: (payload: any) =>
    request<any>('/catalog/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: (id: string, payload: any) =>
    request<any>(`/catalog/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteProduct: (id: string) =>
    request<any>(`/catalog/products/${id}`, { method: 'DELETE' }),

  // Customers
  listCustomers: (search?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    return request<any>(`/customers?${params.toString()}`);
  },
  createCustomer: (payload: any) =>
    request<any>('/customers', { method: 'POST', body: JSON.stringify(payload) }),

  // Presets
  listPresets: (presetType?: string, acType?: string, quotationType?: string) => {
    const params = new URLSearchParams();
    if (presetType) params.append('presetType', presetType);
    if (acType) params.append('acType', acType);
    if (quotationType) params.append('quotationType', quotationType);
    return request<any>(`/quotations/presets?${params.toString()}`);
  },
  createPreset: (payload: any) =>
    request<any>('/quotations/presets', { method: 'POST', body: JSON.stringify(payload) }),
  updatePreset: (id: string, payload: any) =>
    request<any>(`/quotations/presets/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deletePreset: (id: string) =>
    request<any>(`/quotations/presets/${id}`, { method: 'DELETE' }),

  // Quotations
  getQuotationConfig: () => request<any>('/quotations/config'),
  updateQuotationConfig: (data: any) =>
    request<any>('/quotations/config', { method: 'PUT', body: JSON.stringify(data) }),
  createQuotation: (payload: any) =>
    request<any>('/quotations', { method: 'POST', body: JSON.stringify(payload) }),
  listQuotations: (status?: string, search?: string, acType?: string) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (search) params.append('search', search);
    if (acType) params.append('acType', acType);
    return request<any>(`/quotations?${params.toString()}`);
  },
  getQuotationById: (id: string) => request<any>(`/quotations/${id}`),
  updateQuotation: (id: string, payload: any) =>
    request<any>(`/quotations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteQuotation: (id: string) =>
    request<any>(`/quotations/${id}`, { method: 'DELETE' }),
  updateQuotationStatus: (id: string, status: string) =>
    request<any>(`/quotations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  getPdfDownloadUrl: (id: string) => `${API_BASE}/quotations/${id}/pdf`,
  // Download protected PDF with the same Bearer token used by normal API calls.
  downloadQuotationPdf: async (id: string): Promise<void> => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE}/quotations/${encodeURIComponent(id)}/pdf`, {
      method: 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(activeEmployeeId ? { 'x-employee-id': activeEmployeeId } : {}),
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => null);
      throw new ApiError(error?.message || `PDF download failed (${response.status})`, error?.errorType);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `quotation-${id}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  },
};
