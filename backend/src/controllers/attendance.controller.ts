import { Response } from 'express';
import { inMemoryDB } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';
import { generateRotatingQRToken, validateRotatingQRToken } from '../utils/crypto';
import { isWithinOfficeRadius } from '../utils/geo';
import {
  calculateDurationMinutes,
  calculateOvertimeMinutes,
  formatMinutesToDuration,
  formatTime12h,
  getTodayDateString,
} from '../utils/calculations';

export const attendanceController = {
  // 1. Get Live Rotating QR Token (Admin Office Kiosk / Screen)
  getTodayQR: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const todayStr = getTodayDateString();
    const office = inMemoryDB.officeConfig || {
      officeName: 'ECDIAL Headquarters',
      latitude: 13.0827,
      longitude: 80.2707,
      allowedRadiusMeters: 100.0,
      qrRotationSeconds: 30,
    };

    const rotationSeconds = office.qrRotationSeconds || 30;
    const qrData = generateRotatingQRToken(todayStr, rotationSeconds);

    res.json({
      success: true,
      data: {
        token: qrData.token,
        expiresAt: qrData.expiresAt,
        timeWindow: qrData.timeWindow,
        secondsRemaining: qrData.secondsRemaining,
        rotationSeconds,
        officeName: office.officeName,
        date: todayStr,
      },
    });
  },

  // 2. Get Employee Today's Attendance Status
  getTodayStatus: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employeeId = (req.query.employeeId as string) || req.user.id;
    const todayStr = getTodayDateString();
    const todayDate = new Date();
    const dayOfWeek = todayDate.getDay(); // 0 = Sun, 1 = Mon ...

    // Check holiday
    const holiday = inMemoryDB.holidays.find((h) => h.date === todayStr);

    // Check schedule
    const schedule = inMemoryDB.schedules.find(
      (s) => s.employeeId === employeeId && s.dayOfWeek === dayOfWeek
    );
    const isWorkingDay = schedule ? schedule.isWorkingDay : dayOfWeek !== 0;

    // Check attendance record
    const attendance = inMemoryDB.attendances.find(
      (a) => a.employeeId === employeeId && a.date === todayStr
    );

    // Check pending request
    const pendingRequest = inMemoryDB.attendanceRequests.find(
      (r) =>
        r.employeeId === employeeId &&
        r.status === 'WAITING_FOR_APPROVAL' &&
        r.dates.includes(todayStr)
    );

    const office = inMemoryDB.officeConfig;

    let displayStatus = 'NOT_MARKED';
    let checkInFormatted = null;
    let checkOutFormatted = null;
    let durationFormatted = null;

    if (attendance) {
      if (attendance.checkInTime) {
        checkInFormatted = formatTime12h(attendance.checkInTime);
      }
      if (attendance.checkOutTime) {
        checkOutFormatted = formatTime12h(attendance.checkOutTime);
      }
      if (attendance.workingDurationMinutes) {
        durationFormatted = formatMinutesToDuration(attendance.workingDurationMinutes);
      }

      if (attendance.status === 'PRESENT') {
        displayStatus = attendance.checkOutTime ? 'COMPLETED' : 'CHECKED_IN';
      } else {
        displayStatus = attendance.status;
      }
    } else if (pendingRequest) {
      displayStatus = 'WAITING_FOR_APPROVAL';
    } else if (holiday) {
      displayStatus = 'HOLIDAY';
    } else if (!isWorkingDay) {
      displayStatus = 'WEEKLY_OFF';
    }

    res.json({
      success: true,
      data: {
        date: todayStr,
        displayStatus,
        attendance: attendance
          ? {
              ...attendance,
              checkInFormatted,
              checkOutFormatted,
              durationFormatted,
            }
          : null,
        holiday: holiday ? { name: holiday.name, description: holiday.description } : null,
        isWeeklyOff: !isWorkingDay && !holiday,
        schedule: schedule
          ? {
              startTime: schedule.startTime,
              endTime: schedule.endTime,
              isWorkingDay: schedule.isWorkingDay,
            }
          : null,
        office: office
          ? {
              officeName: office.officeName,
              allowedRadiusMeters: office.allowedRadiusMeters,
            }
          : null,
      },
    });
  },

  // 3. Employee Check-In (Authoritative 14-Point Server Validation)
  checkIn: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { qrToken, latitude, longitude, accuracy } = req.body;
    const employee = inMemoryDB.users.find((u) => u.id === req.user!.id);

    // Rule 1, 2, 3: Employee exists & active
    if (!employee || !employee.isActive) {
      res.status(403).json({ success: false, message: 'Employee account is inactive or not found.' });
      return;
    }

    const todayStr = getTodayDateString();
    const todayDate = new Date();
    const dayOfWeek = todayDate.getDay();

    // Rule 9: Check existing duplicate check-in
    const existingAttendance = inMemoryDB.attendances.find(
      (a) => a.employeeId === employee.id && a.date === todayStr
    );

    if (existingAttendance && existingAttendance.checkInTime) {
      const existingCheckInTime = formatTime12h(existingAttendance.checkInTime);
      res.status(400).json({
        success: false,
        errorType: 'DUPLICATE_CHECKIN',
        message: `Attendance already marked.\nCheck-in: ${existingCheckInTime}`,
        checkInTime: existingCheckInTime,
      });
      return;
    }

    // Rule 4, 5, 6, 7: Validate QR token
    const office = inMemoryDB.officeConfig || {
      officeName: 'ECDIAL Headquarters',
      latitude: 13.0827,
      longitude: 80.2707,
      allowedRadiusMeters: 100.0,
      qrRotationSeconds: 30,
    };

    const qrValidation = validateRotatingQRToken(qrToken, todayStr, office.qrRotationSeconds || 30);
    if (!qrValidation.isValid) {
      res.status(400).json({
        success: false,
        errorType: 'INVALID_QR',
        message: 'QR code is invalid or expired.',
      });
      return;
    }

    // Rule 10, 11: Validate GPS presence & accuracy
    if (latitude === undefined || longitude === undefined || accuracy === undefined) {
      res.status(400).json({
        success: false,
        errorType: 'GPS_UNAVAILABLE',
        message: 'Unable to verify your location. Please enable location and try again.',
      });
      return;
    }

    if (Number(accuracy) > 150) {
      // Inaccurate GPS reading
      res.status(400).json({
        success: false,
        errorType: 'GPS_INACCURATE',
        message: 'GPS accuracy is poor. Please move to an open area and try again.',
      });
      return;
    }

    // Rule 12, 13: Calculate Distance from Office
    const geoResult = isWithinOfficeRadius(
      Number(latitude),
      Number(longitude),
      office.latitude,
      office.longitude,
      office.allowedRadiusMeters
    );

    if (!geoResult.isWithin) {
      // Audit log failed attempt outside office
      inMemoryDB.auditLogs.push({
        id: `aud-${Date.now()}`,
        employeeId: employee.id,
        employeeName: employee.name,
        action: 'CHECKIN_FAILED_GEOFENCE',
        date: todayStr,
        timestamp: new Date(),
        method: 'QR',
        distance: geoResult.distanceMeters,
        gpsAccuracy: Number(accuracy),
        performedById: employee.id,
        details: JSON.stringify({
          reason: 'Outside allowed radius',
          allowed: office.allowedRadiusMeters,
          actual: geoResult.distanceMeters,
        }),
        createdAt: new Date(),
      });

      res.status(400).json({
        success: false,
        errorType: 'OUTSIDE_OFFICE',
        message: "You're outside the allowed attendance area.",
        distanceMeters: geoResult.distanceMeters,
        allowedRadius: office.allowedRadiusMeters,
      });
      return;
    }

    // Rule 8: Schedule / Working day check
    const schedule = inMemoryDB.schedules.find(
      (s) => s.employeeId === employee.id && s.dayOfWeek === dayOfWeek
    );
    const holiday = inMemoryDB.holidays.find((h) => h.date === todayStr);

    const now = new Date();
    const newAttendance = {
      id: `att-${Date.now()}-${employee.id.substring(0, 5)}`,
      employeeId: employee.id,
      date: todayStr,
      checkInTime: now,
      checkInMethod: 'QR',
      checkInDistance: geoResult.distanceMeters,
      checkInGpsAccuracy: Number(accuracy),
      checkInLatitude: Number(latitude),
      checkInLongitude: Number(longitude),
      checkOutTime: null,
      checkOutDistance: null,
      checkOutGpsAccuracy: null,
      checkOutLatitude: null,
      checkOutLongitude: null,
      workingDurationMinutes: null,
      status: 'PRESENT',
      otMinutes: 0,
      otStatus: 'NONE',
      notes: holiday ? `Present on Holiday (${holiday.name})` : schedule && !schedule.isWorkingDay ? 'Present on Weekly Off' : null,
      createdAt: now,
      updatedAt: now,
    };

    inMemoryDB.attendances.push(newAttendance);

    // Audit log successful check-in
    inMemoryDB.auditLogs.push({
      id: `aud-${Date.now()}`,
      employeeId: employee.id,
      employeeName: employee.name,
      action: 'CHECK_IN',
      date: todayStr,
      timestamp: now,
      method: 'QR',
      distance: geoResult.distanceMeters,
      gpsAccuracy: Number(accuracy),
      performedById: employee.id,
      details: JSON.stringify({ checkInTime: now.toISOString() }),
      createdAt: now,
    });

    const formattedTime = formatTime12h(now);

    res.json({
      success: true,
      message: '✓ Attendance Marked',
      data: {
        status: 'PRESENT',
        checkInTime: formattedTime,
        date: todayStr,
        distanceMeters: geoResult.distanceMeters,
      },
    });
  },

  // 4. Employee Check-Out
  checkOut: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { latitude, longitude, accuracy } = req.body;
    const employee = inMemoryDB.users.find((u) => u.id === req.user!.id);
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    const todayStr = getTodayDateString();
    const attendance = inMemoryDB.attendances.find(
      (a) => a.employeeId === employee.id && a.date === todayStr
    );

    if (!attendance || !attendance.checkInTime) {
      res.status(400).json({
        success: false,
        message: 'No open check-in found for today. Please mark attendance first.',
      });
      return;
    }

    if (attendance.checkOutTime) {
      const formattedCheckOut = formatTime12h(attendance.checkOutTime);
      res.status(400).json({
        success: false,
        errorType: 'DUPLICATE_CHECKOUT',
        message: `Attendance already closed.\nCheck-out: ${formattedCheckOut}`,
        checkOutTime: formattedCheckOut,
      });
      return;
    }

    const now = new Date();
    attendance.checkOutTime = now;
    attendance.checkOutLatitude = latitude !== undefined ? Number(latitude) : null;
    attendance.checkOutLongitude = longitude !== undefined ? Number(longitude) : null;
    attendance.checkOutGpsAccuracy = accuracy !== undefined ? Number(accuracy) : null;

    // Calculate working duration
    const durationMins = calculateDurationMinutes(new Date(attendance.checkInTime), now);
    attendance.workingDurationMinutes = durationMins;

    // Check schedule for Overtime
    const dayOfWeek = now.getDay();
    const schedule = inMemoryDB.schedules.find(
      (s) => s.employeeId === employee.id && s.dayOfWeek === dayOfWeek
    );

    let otMinutes = 0;
    let otStatus = 'NONE';

    if (schedule && schedule.endTime) {
      otMinutes = calculateOvertimeMinutes(now, schedule.endTime);
      if (otMinutes >= 30) {
        // More than 30 mins overtime requires admin approval
        otStatus = 'OT_PENDING_APPROVAL';
      }
    }

    attendance.otMinutes = otMinutes;
    attendance.otStatus = otStatus;
    attendance.updatedAt = now;

    // Audit log checkout
    inMemoryDB.auditLogs.push({
      id: `aud-${Date.now()}`,
      employeeId: employee.id,
      employeeName: employee.name,
      action: 'CHECK_OUT',
      date: todayStr,
      timestamp: now,
      method: 'MOBILE',
      distance: null,
      gpsAccuracy: accuracy ? Number(accuracy) : null,
      performedById: employee.id,
      details: JSON.stringify({
        checkIn: attendance.checkInTime,
        checkOut: now,
        durationMinutes: durationMins,
        otMinutes,
        otStatus,
      }),
      createdAt: now,
    });

    const checkInFormatted = formatTime12h(attendance.checkInTime);
    const checkOutFormatted = formatTime12h(now);
    const durationFormatted = formatMinutesToDuration(durationMins);

    res.json({
      success: true,
      message: '✓ Attendance Complete',
      data: {
        status: 'COMPLETED',
        checkInTime: checkInFormatted,
        checkOutTime: checkOutFormatted,
        duration: durationFormatted,
        otMinutes,
        otStatus,
        potentialOtFormatted: otMinutes > 0 ? formatMinutesToDuration(otMinutes) : null,
      },
    });
  },

  // 5. Submit Single or Multi-Day Attendance Request / Correction
  submitAttendanceRequest: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { requestType, dates, checkInTime, checkOutTime, reason, remarks } = req.body;

    if (!dates || !Array.isArray(dates) || dates.length === 0) {
      res.status(400).json({ success: false, message: 'Please select at least one date.' });
      return;
    }

    if (!reason || reason.trim() === '') {
      res.status(400).json({ success: false, message: 'Please provide a reason for the attendance request.' });
      return;
    }

    const employee = inMemoryDB.users.find((u) => u.id === req.user!.id);
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    const newRequest = {
      id: `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      employeeId: employee.id,
      requestType: requestType || (dates.length > 1 ? 'MULTI_DAY_MISSED' : 'CHECKIN_FAILURE'),
      dates: JSON.stringify(dates),
      checkInTime: checkInTime || '09:00',
      checkOutTime: checkOutTime || '20:00',
      reason,
      remarks: remarks || '',
      status: 'WAITING_FOR_APPROVAL',
      reviewedById: null,
      reviewedAt: null,
      reviewRemarks: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    inMemoryDB.attendanceRequests.push(newRequest);

    // Audit log
    inMemoryDB.auditLogs.push({
      id: `aud-${Date.now()}`,
      employeeId: employee.id,
      employeeName: employee.name,
      action: 'REQUEST_SUBMITTED',
      date: dates[0],
      timestamp: new Date(),
      method: 'MANUAL_REQUEST',
      performedById: employee.id,
      details: JSON.stringify({ dates, requestType: newRequest.requestType, reason }),
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Attendance request submitted successfully. Waiting for admin approval.',
      data: newRequest,
    });
  },

  // 6. Get Monthly Visual Calendar
  getMonthlyCalendar: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employeeId = (req.query.employeeId as string) || req.user.id;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1; // 1-12

    const daysInMonth = new Date(year, month, 0).getDate();
    const calendarDays = [];

    const todayStr = getTodayDateString();
    const now = new Date();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const d = new Date(year, month - 1, day);
      const dayOfWeek = d.getDay();

      // Find schedule
      const schedule = inMemoryDB.schedules.find(
        (s) => s.employeeId === employeeId && s.dayOfWeek === dayOfWeek
      );
      const isWorkingDay = schedule ? schedule.isWorkingDay : dayOfWeek !== 0;

      // Find holiday
      const holiday = inMemoryDB.holidays.find((h) => h.date === dateStr);

      // Find attendance
      const attendance = inMemoryDB.attendances.find(
        (a) => a.employeeId === employeeId && a.date === dateStr
      );

      // Find pending request
      const pendingRequest = inMemoryDB.attendanceRequests.find(
        (r) =>
          r.employeeId === employeeId &&
          r.status === 'WAITING_FOR_APPROVAL' &&
          r.dates.includes(dateStr)
      );

      let status = 'FUTURE';
      let colorCode = 'GREY'; // GREEN, RED, YELLOW, PURPLE, GREY
      let badge = '';

      if (dateStr > todayStr) {
        status = 'UPCOMING';
        colorCode = 'GREY';
        if (holiday) badge = 'HOLIDAY';
        else if (!isWorkingDay) badge = 'WEEKLY_OFF';
      } else if (attendance) {
        if (attendance.otStatus === 'OT_APPROVED' || (attendance.otStatus === 'OT_PENDING_APPROVAL' && attendance.otMinutes > 0)) {
          status = 'PRESENT_WITH_OT';
          colorCode = 'PURPLE';
          badge = 'OVERTIME';
        } else if (attendance.status === 'PRESENT') {
          status = 'PRESENT';
          colorCode = 'GREEN';
          badge = 'PRESENT';
        } else if (attendance.status === 'INCOMPLETE') {
          status = 'INCOMPLETE';
          colorCode = 'YELLOW';
          badge = 'INCOMPLETE';
        }
      } else if (pendingRequest) {
        status = 'WAITING_FOR_APPROVAL';
        colorCode = 'YELLOW';
        badge = 'WAITING_APPROVAL';
      } else if (holiday) {
        status = 'HOLIDAY';
        colorCode = 'GREY';
        badge = 'HOLIDAY';
      } else if (!isWorkingDay) {
        status = 'WEEKLY_OFF';
        colorCode = 'GREY';
        badge = 'WEEKLY_OFF';
      } else if (dateStr < todayStr) {
        status = 'ABSENT';
        colorCode = 'RED';
        badge = 'ABSENT';
      } else {
        status = 'NOT_MARKED_YET';
        colorCode = 'GREY';
        badge = 'TODAY';
      }

      calendarDays.push({
        date: dateStr,
        dayNumber: day,
        dayOfWeek,
        dayName: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dayOfWeek],
        status,
        colorCode, // 'GREEN' | 'RED' | 'YELLOW' | 'PURPLE' | 'GREY'
        badge,
        holidayName: holiday ? holiday.name : null,
        checkIn: attendance?.checkInTime ? formatTime12h(attendance.checkInTime) : null,
        checkOut: attendance?.checkOutTime ? formatTime12h(attendance.checkOutTime) : null,
        workingDuration: attendance?.workingDurationMinutes
          ? formatMinutesToDuration(attendance.workingDurationMinutes)
          : null,
        otFormatted: attendance?.otMinutes ? formatMinutesToDuration(attendance.otMinutes) : null,
        otStatus: attendance?.otStatus || null,
        pendingRequestId: pendingRequest ? pendingRequest.id : null,
      });
    }

    res.json({
      success: true,
      data: {
        year,
        month,
        days: calendarDays,
      },
    });
  },

  // 7. Admin Daily Overview Dashboard
  getTodayDashboard: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const todayStr = (req.query.date as string) || getTodayDateString();
    const roleFilter = req.query.role as string;
    const statusFilter = req.query.status as string;
    const searchFilter = (req.query.search as string)?.toLowerCase();

    let users = inMemoryDB.users.filter((u) => u.isActive);
    if (roleFilter) {
      users = users.filter((u) => u.role === roleFilter);
    }
    if (searchFilter) {
      users = users.filter(
        (u) =>
          u.name.toLowerCase().includes(searchFilter) ||
          u.employeeCode.toLowerCase().includes(searchFilter)
      );
    }

    const todayDate = new Date(todayStr);
    const dayOfWeek = todayDate.getDay();
    const holiday = inMemoryDB.holidays.find((h) => h.date === todayStr);

    let presentCount = 0;
    let absentCount = 0;
    let pendingCount = 0;
    let incompleteCount = 0;
    let otPendingCount = 0;

    const employeeRows = users.map((employee) => {
      const schedule = inMemoryDB.schedules.find(
        (s) => s.employeeId === employee.id && s.dayOfWeek === dayOfWeek
      );
      const isWorkingDay = schedule ? schedule.isWorkingDay : dayOfWeek !== 0;

      const attendance = inMemoryDB.attendances.find(
        (a) => a.employeeId === employee.id && a.date === todayStr
      );

      const pendingRequest = inMemoryDB.attendanceRequests.find(
        (r) =>
          r.employeeId === employee.id &&
          r.status === 'WAITING_FOR_APPROVAL' &&
          r.dates.includes(todayStr)
      );

      let status = 'NOT_MARKED';
      let ot = null;

      if (attendance) {
        if (attendance.otStatus === 'OT_PENDING_APPROVAL') {
          otPendingCount++;
          ot = `${formatMinutesToDuration(attendance.otMinutes)} (Pending)`;
        } else if (attendance.otStatus === 'OT_APPROVED') {
          ot = `${formatMinutesToDuration(attendance.otMinutes)} (Approved)`;
        }

        if (attendance.status === 'PRESENT') {
          presentCount++;
          status = attendance.checkOutTime ? 'COMPLETED' : 'PRESENT';
        } else if (attendance.status === 'INCOMPLETE') {
          incompleteCount++;
          status = 'INCOMPLETE';
        }
      } else if (pendingRequest) {
        pendingCount++;
        status = 'WAITING_FOR_APPROVAL';
      } else if (holiday) {
        status = 'HOLIDAY';
      } else if (!isWorkingDay) {
        status = 'WEEKLY_OFF';
      } else {
        absentCount++;
        status = 'ABSENT';
      }

      return {
        id: employee.id,
        employeeCode: employee.employeeCode,
        name: employee.name,
        role: employee.role,
        department: employee.department,
        checkIn: attendance?.checkInTime ? formatTime12h(attendance.checkInTime) : null,
        checkOut: attendance?.checkOutTime ? formatTime12h(attendance.checkOutTime) : null,
        duration: attendance?.workingDurationMinutes
          ? formatMinutesToDuration(attendance.workingDurationMinutes)
          : null,
        status,
        ot,
        otStatus: attendance?.otStatus || null,
        attendanceId: attendance?.id || null,
        schedule: schedule
          ? `${schedule.startTime} - ${schedule.endTime} (${schedule.isWorkingDay ? 'Working' : 'Off'})`
          : '09:00 - 20:00',
      };
    });

    // Apply status filter if present
    const filteredRows = statusFilter
      ? employeeRows.filter((r) => r.status === statusFilter)
      : employeeRows;

    res.json({
      success: true,
      data: {
        date: todayStr,
        summary: {
          present: presentCount,
          absent: absentCount,
          pending: pendingCount,
          incomplete: incompleteCount,
          otPending: otPendingCount,
          totalEmployees: users.length,
        },
        employees: filteredRows,
      },
    });
  },
};
