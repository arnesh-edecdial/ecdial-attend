import { Response } from 'express';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';
import { calculateDurationMinutes, formatMinutesToDuration, formatTime12h } from '../utils/calculations';

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

      const finalStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
      await prisma.attendanceRequest.update({
        where: { id },
        data: {
          status: finalStatus,
          reviewedById: reviewerId,
          reviewedAt: new Date(),
          reviewRemarks: remarks || null,
        },
      });

      if (action === 'APPROVE') {
        let parsedDates: string[] = [];
        try {
          parsedDates = typeof request.dates === 'string' ? JSON.parse(request.dates) : request.dates;
        } catch {
          parsedDates = [request.dates];
        }

        const inTimeStr = approvedCheckInTime || request.checkInTime || '09:00';
        const outTimeStr = approvedCheckOutTime !== undefined ? approvedCheckOutTime : (request.checkOutTime || null);

        for (const dateStr of parsedDates) {
          const inDate = new Date(`${dateStr}T${inTimeStr}:00`);
          let outDate: Date | null = null;
          let durMins: number | null = null;

          if (outTimeStr && outTimeStr.trim() !== '') {
            outDate = new Date(`${dateStr}T${outTimeStr}:00`);
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
              notes: `Approved via Attendance Request (${request.reason})`,
            },
            create: {
              employeeId: request.employeeId,
              date: dateStr,
              checkInTime: inDate,
              checkOutTime: outDate,
              checkInMethod: 'MANUAL_APPROVAL',
              workingDurationMinutes: durMins || null,
              status: 'PRESENT',
              notes: `Approved via Attendance Request (${request.reason})`,
            },
          });
        }
      }

      // Log Audit
      await prisma.attendanceAuditLog.create({
        data: {
          employeeId: request.employeeId,
          employeeName: request.employee.name,
          action: action === 'APPROVE' ? 'REQUEST_APPROVED' : 'REQUEST_REJECTED',
          date: new Date().toISOString().substring(0, 10),
          method: 'MANUAL_APPROVAL',
          performedById: reviewerId,
          details: JSON.stringify({ requestId: id, action, remarks, reviewerName }),
        },
      });

      res.json({
        success: true,
        message: `Attendance request ${action === 'APPROVE' ? 'Approved' : 'Rejected'} successfully.`,
      });
    } catch (err: any) {
      console.error('[Process Approval Error]', err);
      res.status(500).json({ success: false, message: 'Failed to process approval.' });
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
        inDate = new Date(`${date}T${checkInTime}:00`);
      }

      if (checkOutTime && checkOutTime.trim() !== '') {
        outDate = new Date(`${date}T${checkOutTime}:00`);
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
