import { Response } from 'express';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';
import {
  calculateDurationMinutes,
  formatMinutesToDuration,
  formatTime12h,
  parseISTDateTime,
} from '../utils/calculations';
import { notificationService } from '../services/notification.service';



export const approvalController = {
  // 1. List All Pending Approvals (Attendance Requests & Pending Overtime)
  listPendingApprovals: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const pendingRequests = await prisma.attendanceRequest.findMany({
        where: { status: { in: ['WAITING_FOR_APPROVAL', 'UNDER_APPROVAL'] } },
        include: { employee: true },
        orderBy: { createdAt: 'desc' },
      });

      const formattedRequests = pendingRequests.map((r) => {
        let parsedDates: string[] = [];
        try {
          parsedDates = typeof r.dates === 'string' ? JSON.parse(r.dates) : r.dates;
        } catch {
          parsedDates = [r.dates];
        }

        let typeLabel = 'Attendance Request';
        if (r.requestType === 'TODAY_ATTENDANCE') typeLabel = "Today's Check-in Request";
        else if (r.requestType === 'CLOSING_REQUEST' || r.requestType === 'EARLY_CHECKOUT') typeLabel = 'Attendance Closing Request';
        else if (r.requestType === 'MULTI_DAY_MISSED') typeLabel = 'Multi-Day Attendance Request';

        return {
          id: r.id,
          requestType: r.requestType,
          type: typeLabel,
          employeeId: r.employeeId,
          employeeName: r.employee?.name || 'Unknown Employee',
          employeeCode: r.employee?.employeeCode || 'EMP',
          role: r.employee?.role || 'TECHNICIAN',
          dates: parsedDates,
          datesFormatted: parsedDates.join(', '),
          checkInTime: r.checkInTime,
          checkOutTime: r.checkOutTime,
          reason: r.reason,
          remarks: r.remarks,
          status: r.status,
          submittedAt: r.createdAt,
        };
      });

      // Pending Overtime Approvals
      const pendingOTAttendances = await prisma.attendance.findMany({
        where: { otStatus: 'OT_PENDING_APPROVAL' },
        include: { employee: true },
        orderBy: { date: 'desc' },
      });

      const formattedOT = pendingOTAttendances.map((a) => ({
        id: `ot-${a.id}`,
        attendanceId: a.id,
        requestType: 'OVERTIME',
        type: 'Overtime Approval',
        employeeId: a.employeeId,
        employeeName: a.employee?.name || 'Unknown Employee',
        employeeCode: a.employee?.employeeCode || 'EMP',
        role: a.employee?.role || 'TECHNICIAN',
        dates: [a.date],
        datesFormatted: a.date,
        checkInTime: a.checkInTime ? formatTime12h(a.checkInTime) : null,
        checkOutTime: a.checkOutTime ? formatTime12h(a.checkOutTime) : null,
        otMinutes: a.otMinutes,
        otFormatted: formatMinutesToDuration(a.otMinutes),
        reason: `Overtime of ${formatMinutesToDuration(a.otMinutes)} clocked beyond shift.`,
        remarks: a.notes || '',
        status: 'UNDER_APPROVAL',
        submittedAt: a.updatedAt,
      }));

      const combinedQueue = [...formattedRequests, ...formattedOT];

      res.json({
        success: true,
        data: {
          totalPending: combinedQueue.length,
          attendanceRequestsCount: formattedRequests.length,
          overtimeRequestsCount: formattedOT.length,
          queue: combinedQueue,
        },
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to list pending approvals.' });
    }
  },

  // 2. Process Approval (Approve or Reject with DB Sync)
  processApproval: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const { action, remarks, approvedCheckInTime, approvedCheckOutTime } = req.body;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      res.status(400).json({ success: false, message: "Action must be 'APPROVE' or 'REJECT'." });
      return;
    }

    const reviewerId = req.user?.id;
    const reviewerName = req.user?.name || 'Admin';

    try {
      // Case 1: Overtime Item (starts with "ot-")
      if (id.startsWith('ot-')) {
        const attendanceId = id.replace('ot-', '');
        const attendance = await prisma.attendance.findUnique({
          where: { id: attendanceId },
          include: { employee: true },
        });

        if (!attendance) {
          res.status(404).json({ success: false, message: 'Attendance record not found.' });
          return;
        }

        const newOtStatus = action === 'APPROVE' ? 'OT_APPROVED' : 'OT_REJECTED';
        await prisma.attendance.update({
          where: { id: attendanceId },
          data: { otStatus: newOtStatus },
        });

        await prisma.attendanceAuditLog.create({
          data: {
            employeeId: attendance.employeeId,
            employeeName: attendance.employee.name,
            action: action === 'APPROVE' ? 'OT_APPROVED' : 'OT_REJECTED',
            date: attendance.date,
            method: 'MANUAL_APPROVAL',
            performedById: reviewerId,
            details: JSON.stringify({ otMinutes: attendance.otMinutes, action, remarks, reviewerName }),
          },
        });

        if (action === 'APPROVE') {
          await prisma.appNotification.create({
            data: {
              userId: attendance.employeeId,
              title: 'Overtime Approved',
              message: `Your overtime request for ${attendance.date} was approved.`,
              type: 'OVERTIME_APPROVED',
            },
          });
        }

        res.json({
          success: true,
          message: `Overtime ${action === 'APPROVE' ? 'Approved' : 'Rejected'} successfully.`,
        });
        return;
      }

      // Case 2: Attendance Request
      const request = await prisma.attendanceRequest.findUnique({
        where: { id },
        include: { employee: true },
      });

      if (!request) {
        res.status(404).json({ success: false, message: 'Attendance request not found.' });
        return;
      }

      const isEdited =
        (approvedCheckInTime && approvedCheckInTime !== request.checkInTime) ||
        (approvedCheckOutTime !== undefined && approvedCheckOutTime !== request.checkOutTime);

      const inTimeStr = approvedCheckInTime || request.checkInTime || '09:00';
      const outTimeStr = approvedCheckOutTime !== undefined ? approvedCheckOutTime : (request.checkOutTime || null);

      const finalStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      const reviewNote = isEdited
        ? `[EDITED_BY_ADMIN In:${inTimeStr} Out:${outTimeStr || 'None'}] ${remarks || ''}`.trim()
        : (remarks || null);

      await prisma.attendanceRequest.update({
        where: { id },
        data: {
          status: finalStatus,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewRemarks: reviewNote,
        },
      });

      if (action === 'APPROVE') {
        let parsedDates: string[] = [];
        try {
          parsedDates = typeof request.dates === 'string' ? JSON.parse(request.dates) : request.dates;
        } catch {
          parsedDates = [request.dates];
        }

        for (const dateStr of parsedDates) {
          const inDate = parseISTDateTime(dateStr, inTimeStr);
          let outDate: Date | null = null;
          let durMins: number | null = null;

          if (outTimeStr && outTimeStr.trim() !== '') {
            outDate = parseISTDateTime(dateStr, outTimeStr);
            durMins = calculateDurationMinutes(inDate, outDate);
          }

          await prisma.attendance.upsert({
            where: {
              employeeId_date: {
                employeeId: request.employeeId,
                date: dateStr,
              },
            },
            update: {
              checkInTime: inDate,
              checkOutTime: outDate,
              workingDurationMinutes: durMins || null,
              status: 'PRESENT',
              notes: isEdited
                ? `Approved with updated time by ${reviewerName} (Requested: ${request.checkInTime || '—'}, Approved: ${inTimeStr})`
                : `Approved via Attendance Request (${request.reason})`,
            },
            create: {
              employeeId: request.employeeId,
              date: dateStr,
              checkInTime: inDate,
              checkOutTime: outDate,
              checkInMethod: 'MANUAL_APPROVAL',
              workingDurationMinutes: durMins || null,
              status: 'PRESENT',
              notes: isEdited
                ? `Approved with updated time by ${reviewerName} (Requested: ${request.checkInTime || '—'}, Approved: ${inTimeStr})`
                : `Approved via Attendance Request (${request.reason})`,
            },
          });

          // Dispatch Push & In-App Notification to Employee
          notificationService.notifyEmployeeOfRequestDecision({
            employeeId: request.employeeId,
            requestId: request.id,
            date: dateStr,
            isApproved: true,
            isEdited: !!isEdited,
            inTime: inTimeStr,
            outTime: outTimeStr,
            reviewerName: reviewerName || 'Admin',
          }).catch((err) => console.error('[Notify Employee Decision Error]', err));
        }
      } else {
        // Rejected
        let parsedDates: string[] = [];
        try {
          parsedDates = typeof request.dates === 'string' ? JSON.parse(request.dates) : request.dates;
        } catch {
          parsedDates = [request.dates];
        }
        notificationService.notifyEmployeeOfRequestDecision({
          employeeId: request.employeeId,
          requestId: request.id,
          date: parsedDates[0] || 'requested date',
          isApproved: false,
          isEdited: false,
          reviewerName: reviewerName || 'Admin',
        }).catch((err) => console.error('[Notify Employee Rejection Error]', err));
      }

      // Log Audit
      const auditAction =
        action === 'APPROVE'
          ? isEdited
            ? 'REQUEST_EDITED_AND_APPROVED'
            : 'REQUEST_APPROVED'
          : 'REQUEST_REJECTED';

      await prisma.attendanceAuditLog.create({
        data: {
          employeeId: request.employeeId,
          employeeName: request.employee.name,
          action: auditAction,
          date: new Date().toISOString().substring(0, 10),
          method: 'MANUAL_APPROVAL',
          performedById: reviewerId,
          details: JSON.stringify({
            requestId: id,
            action,
            isEdited,
            requestedCheckIn: request.checkInTime,
            requestedCheckOut: request.checkOutTime,
            approvedCheckIn: inTimeStr,
            approvedCheckOut: outTimeStr,
            remarks,
            reviewerName,
          }),
        },
      });

      const responseMessage = isEdited
        ? 'Attendance request approved with updated time.'
        : `Attendance request ${action === 'APPROVE' ? 'Approved' : 'Processed'} successfully.`;

      res.json({
        success: true,
        message: responseMessage,
      });
    } catch (err: any) {
      console.error('[Process Approval Error]', err);
      res.status(500).json({ success: false, message: 'Failed to process approval.' });
    }
  },

  // 3. Delete Attendance Request (Admin Delete)
  deleteRequest: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { id } = req.params;
    const reviewerId = req.user?.id;
    const reviewerName = req.user?.name || 'Admin';

    try {
      const request = await prisma.attendanceRequest.findUnique({
        where: { id },
        include: { employee: true },
      });

      if (!request) {
        res.status(404).json({ success: false, message: 'Attendance request not found.' });
        return;
      }

      await prisma.attendanceRequest.delete({ where: { id } });

      await prisma.attendanceAuditLog.create({
        data: {
          employeeId: request.employeeId,
          employeeName: request.employee.name,
          action: 'REQUEST_DELETED',
          date: new Date().toISOString().substring(0, 10),
          method: 'MANUAL_DELETION',
          performedById: reviewerId,
          details: JSON.stringify({
            requestId: id,
            dates: request.dates,
            reason: request.reason,
            reviewerName,
          }),
        },
      });

      res.json({
        success: true,
        message: 'Attendance request deleted successfully.',
      });
    } catch (err: any) {
      console.error('[Delete Request Error]', err);
      res.status(500).json({ success: false, message: 'Failed to delete attendance request.' });
    }
  },

  // 3. Admin Direct Resolve Missing Attendance (Rule 14)
  directResolveAttendance: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'IT_ADMIN')) {
      res.status(403).json({ success: false, message: 'Admin permissions required.' });
      return;
    }

    const { employeeId, date, status, checkInTime, checkOutTime, remarks } = req.body;

    if (!employeeId || !date || !status) {
      res.status(400).json({ success: false, message: 'employeeId, date, and status are required.' });
      return;
    }

    try {
      const employee = await prisma.user.findUnique({ where: { id: employeeId } });
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employee not found.' });
        return;
      }

      let inDate: Date | null = null;
      let outDate: Date | null = null;
      let durMins: number | null = null;

      if (checkInTime && checkInTime.trim() !== '') {
        inDate = parseISTDateTime(date, checkInTime);
      }

      if (checkOutTime && checkOutTime.trim() !== '') {
        outDate = parseISTDateTime(date, checkOutTime);
        if (inDate) {
          durMins = calculateDurationMinutes(inDate, outDate);
        }
      }

      const updated = await prisma.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date,
          },
        },
        update: {
          status,
          checkInTime: inDate,
          checkOutTime: outDate,
          workingDurationMinutes: durMins,
          notes: remarks || `Directly resolved by Admin (${req.user.name})`,
        },
        create: {
          employeeId: employee.id,
          date,
          status,
          checkInTime: inDate,
          checkOutTime: outDate,
          checkInMethod: 'ADMIN_DIRECT',
          workingDurationMinutes: durMins,
          notes: remarks || `Directly resolved by Admin (${req.user.name})`,
        },
      });

      await prisma.attendanceAuditLog.create({
        data: {
          employeeId: employee.id,
          employeeName: employee.name,
          action: 'ADMIN_DIRECT_RESOLVE',
          date,
          timestamp: new Date(),
          method: 'ADMIN_PORTAL',
          performedById: req.user.id,
          details: JSON.stringify({ status, checkInTime, checkOutTime, remarks, resolvedBy: req.user.name }),
        },
      });

      res.json({
        success: true,
        message: `Attendance for ${date} marked as ${status}.`,
        data: updated,
      });
    } catch (err: any) {
      console.error('[Direct Resolve Error]', err);
      res.status(500).json({ success: false, message: 'Failed to resolve attendance.' });
    }
  },
};
