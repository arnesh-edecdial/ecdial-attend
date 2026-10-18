import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { dataCache, CACHE_TTL } from './dataCache';

// --------------------------------------------------------------------------
// PRODUCTION CLOUD API URL (Paste your Vercel / Live URL here)
// Example: export const PRODUCTION_API_URL = 'https://ecdial-attend-backend.vercel.app/api';
// Leave as empty string '' to auto-detect local computer Wi-Fi IP for testing.
// --------------------------------------------------------------------------
export const PRODUCTION_API_URL: string = __DEV__ ? '' : 'https://ecdial-attend.vercel.app/api';

function getApiBaseUrl(): string {
  if (PRODUCTION_API_URL && PRODUCTION_API_URL.trim().length > 0) {
    return PRODUCTION_API_URL.trim();
  }

  if (Platform.OS === 'web') {
    return 'http://localhost:4000/api';
  }

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

function getAttendanceDateKey(): string {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1
  ).padStart(2, '0');
  const day = String(
    now.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export interface ApiResponseWithMeta<T = any> {
  data: T;
  etag?: string | null;
  notModified?: boolean;
}

export async function requestWithMeta<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponseWithMeta<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
    'x-employee-id': activeEmployeeId,
    ...(options.headers as Record<string, string> || {}),
  };

  const url = `${getApiBaseUrl()}${endpoint}`;
  let response: Response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (netErr: any) {
    const netError: any = new Error('Unable to connect to Ecdial backend. Please verify your phone is on the same Wi-Fi network.');
    netError.errorType = 'NETWORK_ERROR';
    throw netError;
  }

  if (response.status === 304) {
    return { data: undefined as any, notModified: true };
  }

  const etag = response.headers.get('ETag') || response.headers.get('etag');
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error: any = new Error(data?.message || `Request failed (${response.status})`);
    error.errorType = data?.errorType || 'API_ERROR';
    throw error;
  }

  return { data, etag, notModified: false };
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const url = `${getApiBaseUrl()}${endpoint}`;

  // Automatically deduplicate identical concurrent GET requests
  if (method === 'GET') {
    return dataCache.dedupe(url, async () => {
      const res = await requestWithMeta<T>(endpoint, options);
      return res.data;
    });
  }

  // Non-GET requests (mutations)
  const res = await requestWithMeta<T>(endpoint, options);

  // Invalidate relevant cache patterns on mutation
  if (endpoint.includes('/attendance')) {
    dataCache.invalidate('attendance');
  }
  if (endpoint.includes('/stock-requirements')) {
    dataCache.invalidate('stock-requirements');
  }
  if (endpoint.includes('/catalogues')) {
    dataCache.invalidate('catalogues');
  }
  if (endpoint.includes('/catalog/products')) {
    dataCache.invalidate('products');
  }
  if (endpoint.includes('/customers')) {
    dataCache.invalidate('customers');
  }
  if (endpoint.includes('/auth/employees')) {
    dataCache.invalidate('employees');
  }

  return res.data;
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
  deleteEmployee: (id: string) =>
    request<any>(`/auth/employees/${id}`, { method: 'DELETE' }),

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
  deleteAttendanceRequest: (id: string) =>
    request<any>(`/attendance/approvals/${id}`, { method: 'DELETE' }),
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

  // Catalog & Machines & AC Product Catalogues
  listProducts: (category?: string, search?: string, activeOnly?: boolean, brand?: string) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    if (activeOnly) params.append('activeOnly', 'true');
    if (brand && brand !== 'ALL') params.append('brand', brand);
    return request<any>(`/catalog/products?${params.toString()}`);
  },
  getProduct: (id: string) =>
    request<any>(`/catalog/products/${id}`),
  createProduct: (payload: any) =>
    request<any>('/catalog/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: (id: string, payload: any) =>
    request<any>(`/catalog/products/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteProduct: (id: string) =>
    request<any>(`/catalog/products/${id}`, { method: 'DELETE' }),
  createMachine: (payload: any) =>
    request<any>('/catalog/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateMachine: (id: string, payload: any) =>
    request<any>(`/catalog/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  toggleMachine: (id: string) =>
    request<any>(`/catalog/products/${id}/toggle`, { method: 'PATCH' }),
  deleteMachine: (id: string) =>
    request<any>(`/catalog/products/${id}`, { method: 'DELETE' }),

  /**
   * Upload raw product image bytes directly to Backblaze B2 bucket
   */
  uploadProductImage: async (id: string, localUri: string, mimeType: string = 'image/jpeg') => {
    const fileRes = await fetch(localUri);
    const blob = await fileRes.blob();
    return request<any>(`/catalog/products/${id}/images`, {
      method: 'POST',
      body: blob,
      headers: { 'Content-Type': mimeType || blob.type || 'image/jpeg' },
    });
  },

  deleteProductImage: (id: string, storageFileName: string) =>
    request<any>(`/catalog/products/${id}/images/${storageFileName}`, { method: 'DELETE' }),

  getProductImageUrl: (storageFileName: string) =>
    `${getApiBaseUrl()}/catalog/products/images/${storageFileName}`,

  getProductCataloguePdfUrl: (id: string, filename?: string) =>
    `${getApiBaseUrl()}/catalog/products/${id}/catalogue-pdf${filename ? `?filename=${encodeURIComponent(filename)}` : ''}`,

  // Office Configuration & Geofencing Calibration (3 Office Locations)
  listOfficeConfigs: () => request<any>('/attendance/office-configs'),
  updateOfficeSlot: (id: string, payload: {
    officeName?: string;
    address?: string | null;
    latitude: number;
    longitude: number;
    allowedRadiusMeters: number;
    qrRotationSeconds?: number;
    isDefault?: boolean;
    slotIndex?: number;
  }) =>
    request<any>(`/attendance/office-configs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  getOfficeConfig: () => request<any>('/attendance/office-config'),
  updateOfficeConfig: (payload: {
    officeName?: string;
    address?: string | null;
    latitude: number;
    longitude: number;
    allowedRadiusMeters: number;
    qrRotationSeconds?: number;
  }) =>
    request<any>('/attendance/office-config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Excel Attendance Export Endpoints (Admin Only)
  getTodayExportUrl: (date?: string) => {
    const d = date ? `?date=${date}` : '';
    return `${getApiBaseUrl()}/attendance/export/today${d}`;
  },
  getMonthExportUrl: (year?: number, month?: number) => {
    const y = year || new Date().getFullYear();
    const m = month || new Date().getMonth() + 1;
    return `${getApiBaseUrl()}/attendance/export/month?year=${y}&month=${m}`;
  },

  // QR Image Download / Share
  getOfficeQrImageUrl: () => `${getApiBaseUrl()}/attendance/qr/image.png`,

  // Customers
  listCustomers: (search?: string, page?: number, limit?: number) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (page) params.append('page', String(page));
    if (limit) params.append('limit', String(limit));
    return request<any>(`/customers?${params.toString()}`);
  },
  getCustomer: (id: string) => request<any>(`/customers/${id}`),
  createCustomer: (payload: any) =>
    request<any>('/customers', { method: 'POST', body: JSON.stringify(payload) }),
  updateCustomer: (id: string, payload: any) =>
    request<any>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteCustomer: (id: string) =>
    request<any>(`/customers/${id}`, { method: 'DELETE' }),

  // Quotations
  listQuotations: (search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    return request<any>(`/quotations?${params.toString()}`);
  },
  getQuotation: (id: string) => request<any>(`/quotations/${id}`),
  createQuotation: (payload: any) =>
    request<any>('/quotations', { method: 'POST', body: JSON.stringify(payload) }),
  updateQuotation: (id: string, payload: any) =>
    request<any>(`/quotations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteQuotation: (id: string) =>
    request<any>(`/quotations/${id}`, { method: 'DELETE' }),
  changeQuotationStatus: (id: string, status: string, notes?: string) =>
    request<any>(`/quotations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, notes }) }),
  getQuotationPdfUrl: (id: string, filename?: string) =>
    `${getApiBaseUrl()}/quotations/${id}/pdf${filename ? `?filename=${encodeURIComponent(filename)}` : ''}`,
  getPdfUrl: (id: string, filename?: string) =>
    `${getApiBaseUrl()}/quotations/${id}/pdf${filename ? `?filename=${encodeURIComponent(filename)}` : ''}`,

  // Attendance Requests (Staff self-service)
  createAttendanceRequest: (payload: any) =>
    request<any>('/attendance/requests', { method: 'POST', body: JSON.stringify(payload) }),
  submitAttendanceRequest: (payload: any) =>
    request<any>('/attendance/requests', { method: 'POST', body: JSON.stringify(payload) }),
  getMyAttendanceRequests: () => request<any>('/attendance/requests/my'),

  // In-App & Push Notifications
  listNotifications: () => request<any>('/notifications'),
  markNotificationAsRead: (id: string) =>
    request<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsAsRead: () =>
    request<any>('/notifications/read-all', { method: 'PATCH' }),
  registerDeviceToken: (payload: { token: string; platform: string; deviceId?: string; deviceModel?: string }) =>
    request<any>('/devices/register', { method: 'POST', body: JSON.stringify(payload) }),
  unregisterDeviceToken: (payload?: { token?: string }) =>
    request<any>('/devices/unregister', { method: 'POST', body: JSON.stringify(payload || {}) }),

  // Stock Requirements / Order Requests
  createStockRequirement: (payload: {
    customerId: string;
    productId: string;
    quantity: number;
    priority?: string;
    note?: string;
  }) =>
    request<any>('/stock-requirements', { method: 'POST', body: JSON.stringify(payload) }),
  getMyStockRequirements: () =>
    request<any>('/stock-requirements/my'),
  listStockRequirements: (params?: { status?: string; priority?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.priority) q.append('priority', params.priority);
    if (params?.search) q.append('search', params.search);
    return request<any>(`/stock-requirements?${q.toString()}`);
  },
  getStockRequirement: (id: string) =>
    request<any>(`/stock-requirements/${id}`),
  updateStockRequirement: (id: string, payload: { quantity?: number; priority?: string; note?: string }) =>
    request<any>(`/stock-requirements/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  changeStockRequirementStatus: (id: string, status: string) =>
    request<any>(`/stock-requirements/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  deleteStockRequirement: (id: string) =>
    request<any>(`/stock-requirements/${id}`, { method: 'DELETE' }),

  // AC Catalogues & Brochures
  listCatalogues: (category?: string, search?: string) => {
    const q = new URLSearchParams();
    if (category && category !== 'ALL') q.append('category', category);
    if (search && search.trim().length > 0) q.append('search', search.trim());
    return request<any>(`/catalogues?${q.toString()}`);
  },
  getCatalogue: (id: string) =>
    request<any>(`/catalogues/${id}`),
  uploadCatalogue: (payload: {
    displayName: string;
    category?: string;
    description?: string;
    model?: string;
    fileBase64: string;
    fileName?: string;
  }) =>
    request<any>('/catalogues/upload', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  renameCatalogue: (id: string, payload: { displayName: string; model?: string; category?: string; description?: string }) =>
    request<any>(`/catalogues/${id}/rename`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteCatalogue: (id: string) =>
    request<any>(`/catalogues/${id}`, { method: 'DELETE' }),
  getCataloguePdfUrl: (id: string, filename?: string) =>
    `${getApiBaseUrl()}/catalogues/${id}/download${filename ? `?filename=${encodeURIComponent(filename)}` : ''}`,

  // --------------------------------------------------------------------------
  // SWR Cache-First Helper Methods (Instant Load + Quiet Background Revalidate)
  // --------------------------------------------------------------------------
  getCachedTodayStatus: (
    options?: {
      forceRefresh?: boolean;
      onBackgroundUpdate?: (
        d: any
      ) => void;
    }
  ) => {
    const dateKey =
      getAttendanceDateKey();

    const cacheKey =
      `attendance:status:${activeEmployeeId}:${dateKey}`;

    return dataCache.fetchWithCache(
      cacheKey,

      async () => {
        /*
         * IMPORTANT:
         *
         * Do NOT send an ETag for Attendance.
         *
         * Attendance is time-dependent. The backend must be allowed
         * to recalculate the current status on every refresh.
         */
        const response =
          await requestWithMeta<any>(
            '/attendance/status/today'
          );

        /*
         * Backend response:
         *
         * {
         *   success: true,
         *   data: {
         *      displayStatus: 'ABSENT',
         *      ...
         *   }
         * }
         *
         * Cache ONLY the inner data object.
         */
        return {
          data:
            response?.data?.data ??
            response?.data ??
            null,
          etag: null,
          notModified: false,
        };
      },

      {
        ttlMs:
          CACHE_TTL.ATTENDANCE_STATUS,

        forceRefresh:
          options?.forceRefresh,

        onBackgroundUpdate:
          options?.onBackgroundUpdate,
      }
    );
  },

  getCachedTodayDashboard: (
    options?: {
      forceRefresh?: boolean;
      onBackgroundUpdate?: (
        d: any
      ) => void;
    }
  ) => {
    const dateKey =
      getAttendanceDateKey();

    const cacheKey =
      `attendance:dashboard:${dateKey}`;

    return dataCache.fetchWithCache(
      cacheKey,

      async () => {
        /*
         * Attendance dashboard is time-dependent.
         * Do not send a cached ETag.
         *
         * The backend must recalculate:
         * - present
         * - absent
         * - not marked
         * - currently working
         */
        const response =
          await requestWithMeta<any>(
            '/attendance/dashboard/today'
          );

        /*
         * Store ONLY response.data.
         *
         * The screen expects:
         *
         * dashboardData.summary.present
         *
         * not:
         *
         * dashboardData.data.summary.present
         */
        return {
          data:
            response?.data?.data ??
            response?.data ??
            null,
          etag: null,
          notModified: false,
        };
      },

      {
        ttlMs:
          CACHE_TTL.DASHBOARD,

        forceRefresh:
          options?.forceRefresh,

        onBackgroundUpdate:
          options?.onBackgroundUpdate,
      }
    );
  },

  getCachedOfficeConfigs: (options?: { forceRefresh?: boolean; onBackgroundUpdate?: (d: any) => void }) => {
    return dataCache.fetchWithCache(
      'office:configs:all',
      async (etag) => {
        const headers: Record<string, string> = {};
        if (etag) headers['If-None-Match'] = etag;
        return requestWithMeta<any>('/attendance/office-configs', { headers });
      },
      {
        ttlMs: CACHE_TTL.OFFICE_CONFIG,
        forceRefresh: options?.forceRefresh,
        onBackgroundUpdate: options?.onBackgroundUpdate,
      }
    );
  },

  getCachedProducts: (
    category?: string,
    search?: string,
    options?: { forceRefresh?: boolean; onBackgroundUpdate?: (d: any) => void; brand?: string }
  ) => {
    const brand = options?.brand;
    const cacheKey = `products:${category || 'ALL'}:${brand || 'ALL'}:${search || ''}`;
    return dataCache.fetchWithCache(
      cacheKey,
      async (etag) => {
        const q = new URLSearchParams();
        if (category && category !== 'ALL') q.append('category', category);
        if (brand && brand !== 'ALL') q.append('brand', brand);
        if (search) q.append('search', search);
        const headers: Record<string, string> = {};
        if (etag) headers['If-None-Match'] = etag;
        return requestWithMeta<any>(`/catalog/products?${q.toString()}`, { headers });
      },
      {
        ttlMs: CACHE_TTL.PRODUCTS_STOCK,
        forceRefresh: options?.forceRefresh,
        onBackgroundUpdate: options?.onBackgroundUpdate,
      }
    );
  },

  getCachedCatalogues: (
    category?: string,
    search?: string,
    options?: { forceRefresh?: boolean; onBackgroundUpdate?: (d: any) => void }
  ) => {
    const cacheKey = `catalogues:${category || 'ALL'}:${search || ''}`;
    return dataCache.fetchWithCache(
      cacheKey,
      async (etag) => {
        const q = new URLSearchParams();
        if (category && category !== 'ALL') q.append('category', category);
        if (search && search.trim().length > 0) q.append('search', search.trim());
        const headers: Record<string, string> = {};
        if (etag) headers['If-None-Match'] = etag;
        return requestWithMeta<any>(`/catalogues?${q.toString()}`, { headers });
      },
      {
        ttlMs: CACHE_TTL.CATALOGUES,
        forceRefresh: options?.forceRefresh,
        onBackgroundUpdate: options?.onBackgroundUpdate,
      }
    );
  },

  getCachedStockRequirements: (
    isAdmin: boolean,
    tab: string,
    priority?: string,
    search?: string,
    options?: { forceRefresh?: boolean; onBackgroundUpdate?: (d: any) => void }
  ) => {
    const cacheKey = `stock_req:${isAdmin ? 'ADMIN' : 'STAFF'}:${tab}:${priority || 'ALL'}:${search || ''}`;
    return dataCache.fetchWithCache(
      cacheKey,
      async (etag) => {
        const headers: Record<string, string> = {};
        if (etag) headers['If-None-Match'] = etag;
        if (isAdmin && tab !== 'MY') {
          const q = new URLSearchParams();
          if (tab === 'PENDING') q.append('status', 'PENDING');
          if (priority && priority !== 'ALL') q.append('priority', priority);
          if (search) q.append('search', search);
          return requestWithMeta<any>(`/stock-requirements?${q.toString()}`, { headers });
        } else {
          return requestWithMeta<any>('/stock-requirements/my', { headers });
        }
      },
      {
        ttlMs: CACHE_TTL.STOCK_REQUIREMENTS,
        forceRefresh: options?.forceRefresh,
        onBackgroundUpdate: options?.onBackgroundUpdate,
      }
    );
  },

  getCachedCustomers: (search?: string, options?: { forceRefresh?: boolean; onBackgroundUpdate?: (d: any) => void }) => {
    const cacheKey = `customers:${search || ''}`;
    return dataCache.fetchWithCache(
      cacheKey,
      async (etag) => {
        const q = new URLSearchParams();
        if (search) q.append('search', search);
        const headers: Record<string, string> = {};
        if (etag) headers['If-None-Match'] = etag;
        return requestWithMeta<any>(`/customers?${q.toString()}`, { headers });
      },
      {
        ttlMs: CACHE_TTL.CUSTOMERS,
        forceRefresh: options?.forceRefresh,
        onBackgroundUpdate: options?.onBackgroundUpdate,
      }
    );
  },

  // --------------------------------------------------------------------
  // Service Intake
  // --------------------------------------------------------------------
  getServiceIntakeOptions: () =>
    request<any>('/service-intakes/options'),

  listServiceIntakes: (params?: {
    status?: string;
    customerId?: string;
    site?: string;
    reportedById?: string;
    takingTo?: string;
    search?: string;
    archived?: boolean;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.customerId) q.append('customerId', params.customerId);
    if (params?.site) q.append('site', params.site);
    if (params?.reportedById) q.append('reportedById', params.reportedById);
    if (params?.takingTo) q.append('takingTo', params.takingTo);
    if (params?.search) q.append('search', params.search);
    if (params?.archived) q.append('archived', 'true');
    if (params?.page) q.append('page', String(params.page));
    if (params?.limit) q.append('limit', String(params.limit));
    return request<any>(`/service-intakes?${q.toString()}`);
  },

  getServiceIntake: (id: string) =>
    request<any>(`/service-intakes/${id}`),

  createServiceIntake: (payload: {
    customerId: string;
    siteName?: string;
    problems: string[];
    takingTo: 'SHOWROOM' | 'OFFICE' | 'SERVICE_CENTER';
    notes?: string;
    items?: Array<{ itemType: string; itemName?: string; productId?: string; identifierType?: string; identifierValue?: string; serialNumber?: string; notes?: string }>;
  }) =>
    request<any>('/service-intakes', { method: 'POST', body: JSON.stringify(payload) }),

  updateServiceIntake: (id: string, payload: Partial<{
    customerId: string; siteName: string; problems: string[]; takingTo: string; notes: string;
  }>) =>
    request<any>(`/service-intakes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  deleteServiceIntake: (id: string) =>
    request<any>(`/service-intakes/${id}`, { method: 'DELETE' }),

  changeServiceIntakeLifecycle: (id: string, lifecycleStatus: 'OPEN' | 'CLOSED') =>
    request<any>(`/service-intakes/${id}/lifecycle`, { method: 'POST', body: JSON.stringify({ lifecycleStatus }) }),

  changeServiceIntakeStatus: (id: string, status: string, note?: string) =>
    request<any>(`/service-intakes/${id}/status`, { method: 'POST', body: JSON.stringify({ status, note }) }),

  archiveServiceIntake: (id: string) =>
    request<any>(`/service-intakes/${id}/archive`, { method: 'POST' }),

  addServiceIntakeNote: (id: string, note: string, itemId?: string) =>
    request<any>(`/service-intakes/${id}/notes`, { method: 'POST', body: JSON.stringify({ note, itemId }) }),

  addServiceIntakeItem: (id: string, item: {
    itemType: string; itemName?: string; productId?: string; identifierType?: string; identifierValue?: string; serialNumber?: string; notes?: string;
  }) =>
    request<any>(`/service-intakes/${id}/items`, { method: 'POST', body: JSON.stringify(item) }),

  updateServiceIntakeItem: (id: string, itemId: string, payload: Partial<{
    productId: string | null; itemName: string; problems: string[]; identifierType: string; identifierValue: string; serialNumber: string; notes: string;
  }>) =>
    request<any>(`/service-intakes/${id}/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  deleteServiceIntakeItem: (id: string, itemId: string) =>
    request<any>(`/service-intakes/${id}/items/${itemId}`, { method: 'DELETE' }),

  changeServiceItemStatus: (id: string, itemId: string, status: string, note?: string) =>
    request<any>(`/service-intakes/${id}/items/${itemId}/status`, { method: 'POST', body: JSON.stringify({ status, note }) }),

  changeServiceItemResponsible: (id: string, itemId: string, employeeId: string) =>
    request<any>(`/service-intakes/${id}/items/${itemId}/responsible`, { method: 'POST', body: JSON.stringify({ employeeId }) }),

  /**
   * Uploads raw image bytes read from a local file:// URI (no base64, no multipart).
   * itemId omitted = photo attached to the intake itself rather than one unit.
   */
  uploadServiceIntakeImage: async (id: string, localUri: string, mimeType: string, itemId?: string) => {
    const fileRes = await fetch(localUri);
    const blob = await fileRes.blob();
    const path = itemId ? `/service-intakes/${id}/items/${itemId}/images` : `/service-intakes/${id}/images`;
    return request<any>(path, {
      method: 'POST',
      body: blob,
      headers: { 'Content-Type': mimeType || blob.type || 'image/jpeg' },
    });
  },

  deleteServiceIntakeImage: (id: string, imageId: string) =>
    request<any>(`/service-intakes/${id}/images/${imageId}`, { method: 'DELETE' }),

  getServiceIntakeImageUrl: (storageFileName: string) =>
    `${getApiBaseUrl()}/service-intakes/images/${storageFileName}`,
};
