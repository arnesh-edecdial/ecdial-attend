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

  // 2. Get Employee Today's Attendance Status (Dynamic & State-Aware)
  getTodayStatus: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employeeId = (req.query.employeeId as string) || req.user.id;
    const todayStr = getTodayDateString();
    const todayDate = new Date();
    const dayOfWeek = todayDate.getDay(); // 0 = Sun, 1 = Mon ...

    // Check holiday / company leave
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

    // Check single active/pending request
    const activeRequest = inMemoryDB.attendanceRequests.find(
      (r) =>
        r.employeeId === employeeId &&
        (r.status === 'WAITING_FOR_APPROVAL' || r.status === 'UNDER_APPROVAL')
    );

    const office = inMemoryDB.officeConfig;

    let displayStatus = 'NOT_MARKED';
    let checkInFormatted = null;
    let checkOutFormatted = null;
    let durationFormatted = null;
    let isCurrentlyWorking = false;

    if (holiday) {
      displayStatus = 'COMPANY_LEAVE';
    } else if (attendance) {
      if (attendance.checkInTime) {
        checkInFormatted = formatTime12h(attendance.checkInTime);
      }
      if (attendance.checkOutTime) {
        checkOutFormatted = formatTime12h(attendance.checkOutTime);
      }
      if (attendance.workingDurationMinutes) {
        durationFormatted = formatMinutesToDuration(attendance.workingDurationMinutes);
      } else if (attendance.checkInTime && !attendance.checkOutTime) {
        const currentDur = calculateDurationMinutes(new Date(attendance.checkInTime), new Date());
        durationFormatted = formatMinutesToDuration(currentDur);
      }

      if (attendance.status === 'PRESENT') {
        if (attendance.checkOutTime) {
          displayStatus = 'COMPLETED';
        } else {
          displayStatus = 'CHECKED_IN';
          isCurrentlyWorking = true;
        }
      } else {
        displayStatus = attendance.status;
      }
    } else if (activeRequest) {
      displayStatus = 'WAITING_FOR_APPROVAL';
    } else if (!isWorkingDay) {
      displayStatus = 'WEEKLY_OFF';
    }

    res.json({
      success: true,
      data: {
        date: todayStr,
        displayStatus,
        isCurrentlyWorking,
        activeRequest: activeRequest
          ? {
              id: activeRequest.id,
              requestType: activeRequest.requestType,
              status: activeRequest.status,
              dates: typeof activeRequest.dates === 'string' ? JSON.parse(activeRequest.dates) : activeRequest.dates,
              checkInTime: activeRequest.checkInTime,
              checkOutTime: activeRequest.checkOutTime,
              reason: activeRequest.reason,
            }
          : null,
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

    // Rule 7, 8: Company Leave Day Check (Normal attendance disabled for everyone on Company Leave)
    const holiday = inMemoryDB.holidays.find((h) => h.date === todayStr);
    if (holiday) {
      res.status(400).json({
        success: false,
        errorType: 'COMPANY_LEAVE',
        message: 'Today is a company leave day. Attendance is not required.',
        holidayName: holiday.name,
      });
      return;
    }

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

    const todayDate = new Date();
    const dayOfWeek = todayDate.getDay();
    const schedule = inMemoryDB.schedules.find(
      (s) => s.employeeId === employee.id && s.dayOfWeek === dayOfWeek
    );

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
      notes: schedule && !schedule.isWorkingDay ? 'Present on Weekly Off' : null,
      createdAt: now,
      updatedAt: now,
    };

    inMemoryDB.attendances.push(newAttendance);

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

    const durationMins = calculateDurationMinutes(new Date(attendance.checkInTime), now);
    attendance.workingDurationMinutes = durationMins;

    const dayOfWeek = now.getDay();
    const schedule = inMemoryDB.schedules.find(
      (s) => s.employeeId === employee.id && s.dayOfWeek === dayOfWeek
    );

    let otMinutes = 0;
    let otStatus = 'NONE';

    if (schedule && schedule.endTime) {
      otMinutes = calculateOvertimeMinutes(now, schedule.endTime);
      if (otMinutes >= 30) {
        otStatus = 'OT_PENDING_APPROVAL';
      }
    }

    attendance.otMinutes = otMinutes;
    attendance.otStatus = otStatus;
    attendance.updatedAt = now;

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

  // 5. Submit Attendance Request (Single Active Request Model, Today Request, Closing Request)
  submitAttendanceRequest: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const employee = inMemoryDB.users.find((u) => u.id === req.user!.id);
    if (!employee) {
      res.status(404).json({ success: false, message: 'Employee not found.' });
      return;
    }

    // Rule 25, 26, 27: ONE ACTIVE/PENDING REQUEST ONLY
    const existingActiveRequest = inMemoryDB.attendanceRequests.find(
      (r) =>
        r.employeeId === employee.id &&
        (r.status === 'WAITING_FOR_APPROVAL' || r.status === 'UNDER_APPROVAL')
    );

    if (existingActiveRequest) {
      res.status(400).json({
        success: false,
        errorType: 'ACTIVE_REQUEST_EXISTS',
        message: 'You already have an attendance request under approval.',
        activeRequestId: existingActiveRequest.id,
      });
      return;
    }

    const { requestType, dates, checkInTime, checkOutTime, reason, remarks, closingTime } = req.body;

    const todayStr = getTodayDateString();
    let requestedDates = Array.isArray(dates) && dates.length > 0 ? dates : [todayStr];

    if (!reason || reason.trim() === '') {
      res.status(400).json({ success: false, message: 'Please provide a reason for the attendance request.' });
      return;
    }

    // Determine specific request type
    let finalType = requestType || 'MISSED_ATTENDANCE';
    let finalCheckIn = checkInTime || '09:00';
    let finalCheckOut = checkOutTime || null;

    if (finalType === 'TODAY_ATTENDANCE' || requestedDates.includes(todayStr) && !checkOutTime) {
      finalType = 'TODAY_ATTENDANCE';
      finalCheckOut = null; // Today request does not predict checkout time!
    } else if (finalType === 'CLOSING_REQUEST' || finalType === 'EARLY_CHECKOUT') {
      finalCheckOut = closingTime || checkOutTime || '19:00';
    } else if (requestedDates.length > 1) {
      finalType = 'MULTI_DAY_MISSED';
      finalCheckOut = checkOutTime || '18:00';
    }

    const newRequest = {
      id: `req-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      employeeId: employee.id,
      requestType: finalType,
      dates: JSON.stringify(requestedDates),
      checkInTime: finalCheckIn,
      checkOutTime: finalCheckOut,
      reason,
      remarks: remarks || '',
      status: 'UNDER_APPROVAL', // State: UNDER_APPROVAL
      reviewedById: null,
      reviewedAt: null,
      reviewRemarks: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    inMemoryDB.attendanceRequests.push(newRequest);

    inMemoryDB.auditLogs.push({
      id: `aud-${Date.now()}`,
      employeeId: employee.id,
      employeeName: employee.name,
      action: 'REQUEST_SUBMITTED',
      date: requestedDates[0],
      timestamp: new Date(),
      method: 'MANUAL_REQUEST',
      performedById: employee.id,
      details: JSON.stringify({ dates: requestedDates, requestType: finalType, reason }),
      createdAt: new Date(),
    });

    res.json({
      success: true,
      message: 'Attendance request submitted successfully. Status: UNDER APPROVAL.',
      data: newRequest,
    });
  },

  // 6. Get Monthly Visual Calendar (with HOL, ✓, ½, ×, —)
  getMonthlyCalendar: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employeeId = (req.query.employeeId as string) || req.user.id;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

    const daysInMonth = new Date(year, month, 0).getDate();
    const calendarDays = [];

    const todayStr = getTodayDateString();

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const d = new Date(year, month - 1, day);
      const dayOfWeek = d.getDay();

      const schedule = inMemoryDB.schedules.find(
        (s) => s.employeeId === employeeId && s.dayOfWeek === dayOfWeek
      );
      const isWorkingDay = schedule ? schedule.isWorkingDay : dayOfWeek !== 0;
      const holiday = inMemoryDB.holidays.find((h) => h.date === dateStr);

      const attendance = inMemoryDB.attendances.find(
        (a) => a.employeeId === employeeId && a.date === dateStr
      );

      const pendingRequest = inMemoryDB.attendanceRequests.find(
        (r) =>
          r.employeeId === employeeId &&
          (r.status === 'WAITING_FOR_APPROVAL' || r.status === 'UNDER_APPROVAL') &&
          r.dates.includes(dateStr)
      );

      let status = 'NOT_MARKED';
      let symbol = '—';
      let colorCode = 'GREY';
      let badge = '';

      if (holiday) {
        status = 'COMPANY_LEAVE';
        symbol = 'HOL';
        colorCode = 'GREY';
        badge = holiday.name;
      } else if (attendance) {
        if (attendance.status === 'PRESENT') {
          status = 'PRESENT';
          symbol = '✓';
          colorCode = 'GREEN';
          badge = 'PRESENT';
          if (attendance.otMinutes > 0 && attendance.otStatus === 'OT_APPROVED') {
            badge = `OT +${formatMinutesToDuration(attendance.otMinutes)}`;
            colorCode = 'PURPLE';
          }
        } else if (attendance.status === 'HALF_DAY') {
          status = 'HALF_DAY';
          symbol = '½';
          colorCode = 'YELLOW';
          badge = 'HALF_DAY';
        }
      } else if (pendingRequest) {
        status = 'UNDER_APPROVAL';
        symbol = '½';
        colorCode = 'YELLOW';
        badge = 'UNDER_APPROVAL';
      } else if (!isWorkingDay) {
        status = 'WEEKLY_OFF';
        symbol = '—';
        colorCode = 'GREY';
        badge = 'OFF';
      } else if (dateStr < todayStr) {
        status = 'ABSENT';
        symbol = '×';
        colorCode = 'RED';
        badge = 'ABSENT';
      } else if (dateStr === todayStr) {
        status = 'TODAY';
        symbol = '—';
        colorCode = 'GREY';
        badge = 'TODAY';
      } else {
        status = 'UPCOMING';
        symbol = '—';
        colorCode = 'GREY';
      }

      calendarDays.push({
        date: dateStr,
        dayNumber: day,
        dayOfWeek,
        dayName: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][dayOfWeek],
        status,
        symbol,
        colorCode,
        badge,
        isCompanyLeave: Boolean(holiday),
        holidayName: holiday ? holiday.name : null,
        checkIn: attendance?.checkInTime ? formatTime12h(attendance.checkInTime) : null,
        checkOut: attendance?.checkOutTime ? formatTime12h(attendance.checkOutTime) : null,
        workingDuration: attendance?.workingDurationMinutes
          ? formatMinutesToDuration(attendance.workingDurationMinutes)
          : null,
        otFormatted: attendance?.otMinutes ? formatMinutesToDuration(attendance.otMinutes) : null,
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

  // 7. Admin Daily Overview Dashboard (Dynamic Live Stats & Full Employee List)
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
    let notMarkedCount = 0;
    let currentlyWorkingCount = 0;
    let pendingCount = 0;

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
          (r.status === 'WAITING_FOR_APPROVAL' || r.status === 'UNDER_APPROVAL') &&
          r.dates.includes(todayStr)
      );

      let status = 'NOT_MARKED';
      let statusBadge = '— Not Marked';
      let isWorking = false;
      let checkInFormatted = attendance?.checkInTime ? formatTime12h(attendance.checkInTime) : null;
      let checkOutFormatted = attendance?.checkOutTime ? formatTime12h(attendance.checkOutTime) : null;
      let durationFormatted = null;

      if (holiday) {
        status = 'COMPANY_LEAVE';
        statusBadge = `Holiday (${holiday.name})`;
      } else if (attendance) {
        if (attendance.status === 'PRESENT') {
          presentCount++;
          if (attendance.checkOutTime) {
            status = 'COMPLETED';
            statusBadge = `✓ Present (${checkInFormatted} → ${checkOutFormatted})`;
            durationFormatted = attendance.workingDurationMinutes
              ? formatMinutesToDuration(attendance.workingDurationMinutes)
              : null;
          } else {
            status = 'PRESENT';
            statusBadge = `✓ Present (${checkInFormatted} — Working)`;
            isWorking = true;
            currentlyWorkingCount++;
            const currentDur = calculateDurationMinutes(new Date(attendance.checkInTime), new Date());
            durationFormatted = formatMinutesToDuration(currentDur);
          }
        }
      } else if (pendingRequest) {
        pendingCount++;
        status = 'UNDER_APPROVAL';
        statusBadge = '⏳ Under Approval';
      } else if (!isWorkingDay) {
        status = 'WEEKLY_OFF';
        statusBadge = 'Scheduled Day Off';
      } else {
        absentCount++;
        status = 'ABSENT';
        statusBadge = '× Absent';
      }

      if (status === 'NOT_MARKED') {
        notMarkedCount++;
      }

      return {
        id: employee.id,
        employeeCode: employee.employeeCode,
        name: employee.name,
        role: employee.role,
        department: employee.department,
        checkIn: checkInFormatted,
        checkOut: checkOutFormatted,
        duration: durationFormatted,
        status,
        statusBadge,
        isWorking,
        otMinutes: attendance?.otMinutes || 0,
        otStatus: attendance?.otStatus || 'NONE',
        attendanceId: attendance?.id || null,
        schedule: schedule
          ? `${schedule.startTime} - ${schedule.endTime}`
          : '09:00 - 18:00',
      };
    });

    const filteredRows = statusFilter
      ? employeeRows.filter((r) => r.status === statusFilter)
      : employeeRows;

    res.json({
      success: true,
      data: {
        date: todayStr,
        isCompanyLeave: Boolean(holiday),
        holidayName: holiday?.name || null,
        summary: {
          present: presentCount,
          absent: absentCount,
          notMarked: notMarkedCount,
          currentlyWorking: currentlyWorkingCount,
          pending: pendingCount,
          totalEmployees: users.length,
        },
        employees: filteredRows,
      },
    });
  },
};
