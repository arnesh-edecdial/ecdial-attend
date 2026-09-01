import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { attendanceController } from '../controllers/attendance.controller';
import { scheduleController } from '../controllers/schedule.controller';
import { holidayController } from '../controllers/holiday.controller';
import { officeController } from '../controllers/office.controller';
import { approvalController } from '../controllers/approval.controller';
import { auditController } from '../controllers/audit.controller';
import { catalogController } from '../controllers/catalog.controller';
import { quotationController } from '../controllers/quotation.controller';
import { customerController } from '../controllers/customer.controller';
import { notificationController } from '../controllers/notification.controller';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// ==========================================
// ROLE ACCESS DEFINITIONS (Requirements 17, 18, 19)
// ==========================================
// System-level configuration (Office GPS, Holidays, Schedules)
const SYSTEM_ADMIN_ROLES = ['ADMIN', 'MANAGER'] as const;

// Attendance & Approvals Management (Admin, Manager, Accountant, Service Manager, CRM)
const ATTENDANCE_MANAGEMENT_ROLES = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'SERVICE_MANAGER', 'CRM'] as const;

// Reports (Today & Monthly Excel Downloads)
const REPORT_ROLES = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'SERVICE_MANAGER', 'CRM'] as const;

// Quotation & Customer Management
const BUSINESS_ROLES = ['ADMIN', 'MANAGER', 'SALES', 'ACCOUNTANT', 'SERVICE_MANAGER', 'CRM'] as const;

// ==========================================
// 1. AUTHENTICATION & EMPLOYEE ROUTES
// ==========================================
router.post('/auth/login', authController.login);
router.get('/auth/me', authMiddleware, authController.getCurrentUser);
router.get(
  '/auth/employees',
  authMiddleware,
  requireRole([...ATTENDANCE_MANAGEMENT_ROLES, 'SALES']),
  authController.listEmployees
);
router.post(
  '/auth/employees',
  authMiddleware,
  requireRole(['ADMIN', 'MANAGER']),
  authController.createEmployee
);
router.put(
  '/auth/employees/:id',
  authMiddleware,
  requireRole(['ADMIN', 'MANAGER']),
  authController.updateEmployee
);
router.patch(
  '/auth/employees/:id/toggle',
  authMiddleware,
  requireRole(['ADMIN', 'MANAGER']),
  authController.toggleEmployeeStatus
);
router.patch(
  '/auth/employees/:id/toggle-status',
  authMiddleware,
  requireRole(['ADMIN', 'MANAGER']),
  authController.toggleEmployeeStatus
);
router.delete(
  '/auth/employees/:id',
  authMiddleware,
  requireRole(['ADMIN', 'MANAGER']),
  authController.deleteEmployee
);

// ==========================================
// 2. ATTENDANCE OPERATIONS & WORKFLOWS
// ==========================================
// A. Office Attendance QR Code
router.get('/attendance/qr/today', authMiddleware, attendanceController.getTodayQR);
router.get('/attendance/qr/image.png', attendanceController.getTodayQRImage);

// B. Check-in & Check-out Actions (Supported with and without hyphens)
router.get('/attendance/status/today', authMiddleware, attendanceController.getTodayStatus);
router.post('/attendance/check-in', authMiddleware, attendanceController.checkIn);
router.post('/attendance/checkin', authMiddleware, attendanceController.checkIn);
router.post('/attendance/check-out', authMiddleware, attendanceController.checkOut);
router.post('/attendance/checkout', authMiddleware, attendanceController.checkOut);

// C. Attendance Requests (Single-Day / Closing)
router.post('/attendance/requests', authMiddleware, attendanceController.submitAttendanceRequest);

// D. Monthly Visual Calendar
router.get('/attendance/calendar', authMiddleware, attendanceController.getMonthlyCalendar);

// E. Admin Attendance Dashboard & Excel Export
router.get('/attendance/dashboard/today', authMiddleware, attendanceController.getTodayDashboard);
router.get(
  '/attendance/export/today',
  authMiddleware,
  requireRole(REPORT_ROLES),
  attendanceController.exportTodayExcel
);
router.get(
  '/attendance/export/month',
  authMiddleware,
  requireRole(REPORT_ROLES),
  attendanceController.exportMonthlyExcel
);

// F. Employee Schedules
router.get('/attendance/schedules/:employeeId', authMiddleware, scheduleController.getEmployeeSchedule);
router.put(
  '/attendance/schedules/:employeeId',
  authMiddleware,
  requireRole(SYSTEM_ADMIN_ROLES),
  scheduleController.updateEmployeeSchedule
);

// G. Company Leave / Holidays
router.get('/attendance/holidays', authMiddleware, holidayController.listHolidays);
router.post(
  '/attendance/holidays',
  authMiddleware,
  requireRole(SYSTEM_ADMIN_ROLES),
  holidayController.createHoliday
);
router.delete(
  '/attendance/holidays/:id',
  authMiddleware,
  requireRole(SYSTEM_ADMIN_ROLES),
  holidayController.deleteHoliday
);

// H. Office Geo-fencing & Settings (Admin only)
router.get('/attendance/office-config', authMiddleware, officeController.getConfig);
router.put(
  '/attendance/office-config',
  authMiddleware,
  requireRole(SYSTEM_ADMIN_ROLES),
  officeController.updateConfig
);

// I. Central Approval Queue
router.get(
  '/attendance/approvals',
  authMiddleware,
  requireRole(ATTENDANCE_MANAGEMENT_ROLES),
  approvalController.listPendingApprovals
);
router.post(
  '/attendance/approvals/:id',
  authMiddleware,
  requireRole(ATTENDANCE_MANAGEMENT_ROLES),
  approvalController.processApproval
);
router.delete(
  '/attendance/approvals/:id',
  authMiddleware,
  requireRole(ATTENDANCE_MANAGEMENT_ROLES),
  approvalController.deleteRequest
);
router.post(
  '/attendance/approvals/:id/delete',
  authMiddleware,
  requireRole(ATTENDANCE_MANAGEMENT_ROLES),
  approvalController.deleteRequest
);
router.post(
  '/attendance/direct-resolve',
  authMiddleware,
  requireRole(ATTENDANCE_MANAGEMENT_ROLES),
  approvalController.directResolveAttendance
);

// J. Audit Logs
router.get(
  '/attendance/audit-logs',
  authMiddleware,
  requireRole(ATTENDANCE_MANAGEMENT_ROLES),
  auditController.listAuditLogs
);

// ==========================================
// 3. IN-APP & PUSH NOTIFICATIONS
// ==========================================
router.get('/notifications', authMiddleware, notificationController.listNotifications);
router.patch('/notifications/:id/read', authMiddleware, notificationController.markAsRead);
router.patch('/notifications/read-all', authMiddleware, notificationController.markAllAsRead);
router.post('/devices/register', authMiddleware, notificationController.registerDevice);
router.post('/devices/unregister', authMiddleware, notificationController.unregisterDevice);

// ==========================================
// 4. QUOTATION GENERATION & CATALOG ROUTES
// ==========================================
// A. Product Catalog & Machine Models
router.get('/catalog/products', authMiddleware, catalogController.listProducts);
router.post(
  '/catalog/products',
  authMiddleware,
  requireRole(BUSINESS_ROLES),
  catalogController.createProduct
);
router.put(
  '/catalog/products/:id',
  authMiddleware,
  requireRole(BUSINESS_ROLES),
  catalogController.updateProduct
);
router.patch(
  '/catalog/products/:id/toggle',
  authMiddleware,
  requireRole(BUSINESS_ROLES),
  catalogController.toggleProductStatus
);
router.delete(
  '/catalog/products/:id',
  authMiddleware,
  requireRole(BUSINESS_ROLES),
  catalogController.deleteProduct
);

// B. Quotation Operations
router.get('/quotations/config', authMiddleware, quotationController.getConfig);
router.put(
  '/quotations/config',
  authMiddleware,
  requireRole(SYSTEM_ADMIN_ROLES),
  quotationController.updateConfig
);

router.post('/quotations', authMiddleware, requireRole(BUSINESS_ROLES), quotationController.createQuotation);
router.get('/quotations', authMiddleware, requireRole(BUSINESS_ROLES), quotationController.listQuotations);
router.get('/quotations/:id', authMiddleware, quotationController.getQuotationById);
router.put('/quotations/:id', authMiddleware, requireRole(BUSINESS_ROLES), quotationController.updateQuotation);
router.patch('/quotations/:id/status', authMiddleware, requireRole(BUSINESS_ROLES), quotationController.updateStatus);
router.delete('/quotations/:id', authMiddleware, requireRole(BUSINESS_ROLES), quotationController.deleteQuotation);
router.get('/quotations/:id/pdf', authMiddleware, quotationController.downloadPdf);

// ==========================================
// 5. CUSTOMER MANAGEMENT ROUTES
// ==========================================
router.get('/customers', authMiddleware, requireRole(BUSINESS_ROLES), customerController.listCustomers);
router.get('/customers/:id', authMiddleware, requireRole(BUSINESS_ROLES), customerController.getCustomer);
router.post('/customers', authMiddleware, requireRole(BUSINESS_ROLES), customerController.createCustomer);
router.put('/customers/:id', authMiddleware, requireRole(BUSINESS_ROLES), customerController.updateCustomer);
router.delete('/customers/:id', authMiddleware, requireRole(BUSINESS_ROLES), customerController.deleteCustomer);

export default router;
