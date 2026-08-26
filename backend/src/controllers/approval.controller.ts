import { Response } from 'express';
import { inMemoryDB } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';
import { formatMinutesToDuration, formatTime12h } from '../utils/calculations';

export const approvalController = {
  // 1. List All Pending Approvals (Attendance Requests, Multi-day Requests, Corrections, Overtime)
  listPendingApprovals: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    // A. Pending Attendance Requests
    const pendingRequests = inMemoryDB.attendanceRequests
      .filter((r) => r.status === 'WAITING_FOR_APPROVAL')
      .map((r) => {
        const employee = inMemoryDB.users.find((u) => u.id === r.employeeId);
        let parsedDates: string[] = [];
        try {
          parsedDates = JSON.parse(r.dates);
        } catch {
          parsedDates = [r.dates];
        }

        return {
          id: r.id,
          type: r.requestType === 'MULTI_DAY_MISSED' ? 'MULTI_DAY_REQUEST' : r.requestType === 'CHECKOUT_CORRECTION' ? 'CHECKOUT_CORRECTION' : 'ATTENDANCE_REQUEST',
          employeeId: r.employeeId,
          employeeName: employee?.name || 'Unknown Employee',
          employeeCode: employee?.employeeCode || 'EMP',
          role: employee?.role || 'TECHNICIAN',
          dates: parsedDates,
          datesFormatted: parsedDates.join(', '),
          checkInTime: r.checkInTime,
          checkOutTime: r.checkOutTime,
          reason: r.reason,
          remarks: r.remarks,
          submittedAt: r.createdAt,
        };
      });

    // B. Pending Overtime Approvals
    const pendingOT = inMemoryDB.attendances
      .filter((a) => a.otStatus === 'OT_PENDING_APPROVAL')
      .map((a) => {
        const employee = inMemoryDB.users.find((u) => u.id === a.employeeId);
        return {
          id: `ot-${a.id}`,
          attendanceId: a.id,
          type: 'OVERTIME',
          employeeId: a.employeeId,
          employeeName: employee?.name || 'Unknown Employee',
          employeeCode: employee?.employeeCode || 'EMP',
          role: employee?.role || 'TECHNICIAN',
          dates: [a.date],
          datesFormatted: a.date,
          checkInTime: a.checkInTime ? formatTime12h(a.checkInTime) : null,
          checkOutTime: a.checkOutTime ? formatTime12h(a.checkOutTime) : null,
          otMinutes: a.otMinutes,
          otFormatted: formatMinutesToDuration(a.otMinutes),
          reason: `Potential Overtime of ${formatMinutesToDuration(a.otMinutes)} clocked beyond scheduled shift.`,
          remarks: a.notes || '',
          submittedAt: a.updatedAt,
        };
      });

    const combinedQueue = [...pendingRequests, ...pendingOT];

    res.json({
      success: true,
      data: {
        totalPending: combinedQueue.length,
        attendanceRequestsCount: pendingRequests.length,
        overtimeRequestsCount: pendingOT.length,
        queue: combinedQueue,
      },
    });
  },

  // 2. Action: Approve or Reject a Request
  processApproval: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { action, remarks } = req.body; // action: 'APPROVE' | 'REJECT'

    if (!['APPROVE', 'REJECT'].includes(action)) {
      res.status(400).json({ success: false, message: "Action must be 'APPROVE' or 'REJECT'." });
      return;
    }

    const reviewerId = req.user?.id || 'usr-admin-1';
    const reviewerName = req.user?.name || 'Admin';

    // Case 1: Overtime Item (starts with "ot-")
    if (id.startsWith('ot-')) {
      const attendanceId = id.replace('ot-', '');
      const attendance = inMemoryDB.attendances.find((a) => a.id === attendanceId);

      if (!attendance) {
        res.status(404).json({ success: false, message: 'Attendance record not found.' });
        return;
      }

      const employee = inMemoryDB.users.find((u) => u.id === attendance.employeeId);
      attendance.otStatus = action === 'APPROVE' ? 'OT_APPROVED' : 'OT_REJECTED';
      attendance.updatedAt = new Date();

      // Audit log
      inMemoryDB.auditLogs.push({
        id: `aud-${Date.now()}`,
        employeeId: attendance.employeeId,
        employeeName: employee?.name || 'Employee',
        action: action === 'APPROVE' ? 'OT_APPROVED' : 'OT_REJECTED',
        date: attendance.date,
        timestamp: new Date(),
        method: 'ADMIN_APPROVAL',
        performedById: reviewerId,
        details: JSON.stringify({
          attendanceId,
          otMinutes: attendance.otMinutes,
          reviewer: reviewerName,
          remarks: remarks || '',
        }),
        createdAt: new Date(),
      });

      res.json({
        success: true,
        message: `Overtime ${action === 'APPROVE' ? 'Approved' : 'Rejected'} for ${employee?.name || 'Employee'}.`,
      });
      return;
    }

    // Case 2: Attendance Request
    const request = inMemoryDB.attendanceRequests.find((r) => r.id === id);
    if (!request) {
      res.status(404).json({ success: false, message: 'Attendance request not found.' });
      return;
    }

    request.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    request.reviewedById = reviewerId;
    request.reviewedAt = new Date();
    request.reviewRemarks = remarks || '';
    request.updatedAt = new Date();

    const employee = inMemoryDB.users.find((u) => u.id === request.employeeId);

    // If approved, create or update attendance records for each requested date
    if (action === 'APPROVE') {
      let datesList: string[] = [];
      try {
        datesList = JSON.parse(request.dates);
      } catch {
        datesList = [request.dates];
      }

      for (const dateStr of datesList) {
        const existing = inMemoryDB.attendances.find(
          (a) => a.employeeId === request.employeeId && a.date === dateStr
        );

        const checkInDate = new Date(`${dateStr}T${request.checkInTime || '09:00'}:00`);
        const checkOutDate = request.checkOutTime ? new Date(`${dateStr}T${request.checkOutTime}:00`) : null;
        const durationMins = checkOutDate ? Math.max(0, Math.floor((checkOutDate.getTime() - checkInDate.getTime()) / 60000)) : null;

        if (existing) {
          existing.status = 'PRESENT';
          if (!existing.checkInTime) existing.checkInTime = checkInDate;
          if (request.checkOutTime) existing.checkOutTime = checkOutDate;
          if (durationMins) existing.workingDurationMinutes = durationMins;
          existing.updatedAt = new Date();
        } else {
          inMemoryDB.attendances.push({
            id: `att-req-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            employeeId: request.employeeId,
            date: dateStr,
            checkInTime: checkInDate,
            checkInMethod: 'MANUAL_APPROVAL',
            checkInDistance: null,
            checkInGpsAccuracy: null,
            checkInLatitude: null,
            checkInLongitude: null,
            checkOutTime: checkOutDate,
            checkOutDistance: null,
            checkOutGpsAccuracy: null,
            checkOutLatitude: null,
            checkOutLongitude: null,
            workingDurationMinutes: durationMins,
            status: 'PRESENT',
            otMinutes: 0,
            otStatus: 'NONE',
            notes: `Approved request: ${request.reason}`,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      }
    }

    // Audit log
    inMemoryDB.auditLogs.push({
      id: `aud-${Date.now()}`,
      employeeId: request.employeeId,
      employeeName: employee?.name || 'Employee',
      action: action === 'APPROVE' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED',
      date: new Date().toISOString().substring(0, 10),
      timestamp: new Date(),
      method: 'ADMIN_APPROVAL',
      performedById: reviewerId,
      details: JSON.stringify({
        requestId: request.id,
        dates: request.dates,
        reviewer: reviewerName,
        remarks: remarks || '',
      }),
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: `Request successfully ${action === 'APPROVE' ? 'Approved' : 'Rejected'} for ${employee?.name || 'Employee'}.`,
    });
  },
};
