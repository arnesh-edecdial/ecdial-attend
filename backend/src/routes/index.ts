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
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();

// ==========================================
// 1. AUTHENTICATION & DIRECTORY ROUTES
// ==========================================
router.post('/auth/login', authController.login);
router.get('/auth/me', authMiddleware, authController.getCurrentUser);
router.get('/auth/employees', authMiddleware, authController.listEmployees);

// ==========================================
// 2. ATTENDANCE MANAGEMENT ROUTES
// ==========================================
// A. QR Token (Office Kiosk / Screen)
router.get('/attendance/qr/today', attendanceController.getTodayQR);

// B. Employee Status & Actions
router.get('/attendance/status/today', authMiddleware, attendanceController.getTodayStatus);
router.post('/attendance/checkin', authMiddleware, attendanceController.checkIn);
router.post('/attendance/checkout', authMiddleware, attendanceController.checkOut);

// C. Attendance Requests (Single date, Multi-day, Today Request, Closing Request)
router.post('/attendance/requests', authMiddleware, attendanceController.submitAttendanceRequest);

// D. Monthly Visual Calendar
router.get('/attendance/calendar', authMiddleware, attendanceController.getMonthlyCalendar);

// E. Admin Attendance Dashboard
router.get('/attendance/dashboard/today', authMiddleware, attendanceController.getTodayDashboard);

// F. Employee Schedules
router.get('/attendance/schedules/:employeeId', authMiddleware, scheduleController.getEmployeeSchedule);
router.put(
  '/attendance/schedules/:employeeId',
  authMiddleware,
  requireRole(['ADMIN', 'IT_ADMIN', 'MANAGER']),
  scheduleController.updateEmployeeSchedule
);

// G. Company Leave / Holidays
router.get('/attendance/holidays', authMiddleware, holidayController.listHolidays);
router.post(
  '/attendance/holidays',
  authMiddleware,
  requireRole(['ADMIN', 'IT_ADMIN']),
  holidayController.createHoliday
);
router.delete(
  '/attendance/holidays/:id',
  authMiddleware,
  requireRole(['ADMIN', 'IT_ADMIN']),
  holidayController.deleteHoliday
);

// H. Office Geo-fencing & Settings
router.get('/attendance/office-config', authMiddleware, officeController.getConfig);
router.put(
  '/attendance/office-config',
  authMiddleware,
  requireRole(['ADMIN', 'IT_ADMIN']),
  officeController.updateConfig
);

// I. Central Approval Queue
router.get(
  '/attendance/approvals',
  authMiddleware,
  requireRole(['ADMIN', 'MANAGER', 'IT_ADMIN']),
  approvalController.listPendingApprovals
);
router.post(
  '/attendance/approvals/:id',
  authMiddleware,
  requireRole(['ADMIN', 'MANAGER', 'IT_ADMIN']),
  approvalController.processApproval
);

// J. Audit Logs
router.get(
  '/attendance/audit-logs',
  authMiddleware,
  requireRole(['ADMIN', 'IT_ADMIN', 'MANAGER']),
  auditController.listAuditLogs
);

// ==========================================
// 3. QUOTATION GENERATION & CATALOG ROUTES
// ==========================================
// A. Product Catalog & Machine Models
router.get('/catalog/products', authMiddleware, catalogController.listProducts);
router.post(
  '/catalog/products',
  authMiddleware,
  requireRole(['ADMIN', 'MANAGER']),
  catalogController.createProduct
);
router.put(
  '/catalog/products/:id',
  authMiddleware,
  requireRole(['ADMIN', 'MANAGER']),
  catalogController.updateProduct
);
router.patch(
  '/catalog/products/:id/toggle',
  authMiddleware,
  requireRole(['ADMIN', 'MANAGER']),
  catalogController.toggleProductStatus
);
router.delete(
  '/catalog/products/:id',
  authMiddleware,
  requireRole(['ADMIN', 'MANAGER']),
  catalogController.deleteProduct
);

// B. Quotation Operations
router.get('/quotations/config', authMiddleware, quotationController.getConfig);
router.put(
  '/quotations/config',
  authMiddleware,
  requireRole(['ADMIN', 'MANAGER']),
  quotationController.updateConfig
);

router.post('/quotations', authMiddleware, quotationController.createQuotation);
router.get('/quotations', authMiddleware, quotationController.listQuotations);
router.get('/quotations/:id', authMiddleware, quotationController.getQuotationById);
router.put('/quotations/:id', authMiddleware, quotationController.updateQuotation);
router.patch('/quotations/:id/status', authMiddleware, quotationController.updateStatus);
router.get('/quotations/:id/pdf', authMiddleware, quotationController.downloadPdf);

export default router;
