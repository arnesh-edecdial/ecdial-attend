import { Response } from 'express';
import { prisma } from '../db/store';
import { AuthenticatedRequest } from '../middleware/auth';
import { generateRotatingQRToken, validateRotatingQRToken } from '../utils/crypto';
import { isWithinOfficeRadius } from '../utils/geo';
import {
  calculateDurationMinutes,
  calculateOvertimeMinutes,
  formatMinutesToDuration,
  formatTime12h,
  getTodayDateString,
  isPastCutoffTime,
} from '../utils/calculations';
import { exportService } from '../services/export.service';
import { qrService } from '../services/qr.service';
import { notificationService } from '../services/notification.service';

export const STATIC_OFFICE_QR_TOKEN = 'ECDIAL_OFFICE_ATTENDANCE_QR_HQ_COIMBATORE';

export const attendanceController = {
  // 1. Get Static Office QR Token (Admin Office Screen / Kiosk)
  getTodayQR: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const todayStr = getTodayDateString();

    try {
      const office = (await prisma.officeConfig.findFirst({ where: { isDefault: true } })) ||
        (await prisma.officeConfig.findFirst()) || {
          officeName: 'ECDIAL Headquarters - Coimbatore',
          latitude: 11.0168,
          longitude: 76.9558,
          allowedRadiusMeters: 100.0,
        };

      res.json({
        success: true,
        data: {
          token: STATIC_OFFICE_QR_TOKEN,
          officeName: office.officeName,
          date: todayStr,
          isStatic: true,
        },
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to retrieve office QR token.' });
    }
  },

  // 1b. Get Static Office QR Image as Direct PNG (Download & Share)
  getTodayQRImage: async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const office = (await prisma.officeConfig.findFirst({ where: { isDefault: true } })) || {
        officeName: 'ECDIAL Headquarters - Coimbatore',
      };
      const qrBuffer = await qrService.generateOfficeQRBuffer(office.officeName);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', 'inline; filename="ECDIAL_Office_Attendance_QR.png"');
      res.setHeader('Content-Length', qrBuffer.length);
      res.send(qrBuffer);
    } catch (err: any) {
      console.error('[Generate QR Image Error]', err);
      res.status(500).json({ success: false, message: 'Failed to generate QR image.' });
    }
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

    try {
      // 1. Check holiday / company leave in DB
      const holiday = await prisma.governmentHoliday.findUnique({ where: { date: todayStr } });

      // 2. Check schedule in DB
      const schedule = await prisma.employeeSchedule.findUnique({
        where: {
          employeeId_dayOfWeek: {
            employeeId,
            dayOfWeek,
          },
        },
      });
      const isWorkingDay = schedule ? schedule.isWorkingDay : dayOfWeek !== 0;

      // 3. Check attendance record in DB
      const attendance = await prisma.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId,
            date: todayStr,
          },
        },
      });

      // 4. Check single active/pending request in DB
      const activeRequest = await prisma.attendanceRequest.findFirst({
        where: {
          employeeId,
          status: { in: ['WAITING_FOR_APPROVAL', 'UNDER_APPROVAL'] },
        },
      });

      // 5. Check incomplete previous day (Checked in previously but never checked out)
      const incompletePreviousAttendance = await prisma.attendance.findFirst({
        where: {
          employeeId,
          date: { lt: todayStr },
          checkInTime: { not: null },
          checkOutTime: null,
          status: 'PRESENT',
        },
        orderBy: { date: 'desc' },
      });

      // 6. Office configuration
      const office = await prisma.officeConfig.findFirst({ where: { isDefault: true } });

      let displayStatus = 'NOT_MARKED';
      let checkInFormatted: string | null = null;
      let checkOutFormatted: string | null = null;
      let durationFormatted: string | null = null;
      let isCurrentlyWorking = false;
      let liveOtMinutes = 0;


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

        // ── Live / derived overtime calculation ──
        // DB otMinutes is only set on QR checkout. For live sessions and
        // admin-approved closings we derive it here.
        if (attendance.otMinutes != null && attendance.otMinutes > 0) {
          // Trust the stored value
          liveOtMinutes = attendance.otMinutes;
        } else if (schedule) {
          const scheduleEndParts = schedule.endTime.split(':').map(Number);
          const scheduleHours = (scheduleEndParts[0] || 0);
          const scheduleMinutes = (scheduleEndParts[1] || 0);
          const scheduleTotalMins = scheduleHours * 60 + scheduleMinutes;

          if (isCurrentlyWorking && attendance.checkInTime) {
            // Live session: compute OT vs. how far past schedule end we are now
            const now = new Date();
            // Build a Date for schedule end in the same UTC day as checkInTime
            const checkInDate = new Date(attendance.checkInTime);
            const scheduleEndUTC = new Date(checkInDate);
            // endTime is stored as IST "HH:MM" – convert to UTC offset (+5:30 = 330 min)
            const IST_OFFSET_MINS = 330;
            scheduleEndUTC.setUTCHours(scheduleHours, scheduleMinutes, 0, 0);
            scheduleEndUTC.setTime(scheduleEndUTC.getTime() - IST_OFFSET_MINS * 60 * 1000);
            if (now > scheduleEndUTC) {
              liveOtMinutes = calculateDurationMinutes(scheduleEndUTC, now);
            }
          } else if (!isCurrentlyWorking && attendance.workingDurationMinutes) {
            // Completed via admin approval — otMinutes was never saved in DB
            const workedMins = attendance.workingDurationMinutes;
            const startParts = schedule.startTime.split(':').map(Number);
            const startTotal = (startParts[0] || 0) * 60 + (startParts[1] || 0);
            const scheduleDuration = scheduleTotalMins - startTotal;
            if (workedMins > scheduleDuration) {
              liveOtMinutes = workedMins - scheduleDuration;
            }
          }
        }
      } else if (activeRequest) {
        displayStatus = 'WAITING_FOR_APPROVAL';
      } else if (!isWorkingDay) {
        displayStatus = 'WEEKLY_OFF';
      } else {
        displayStatus = isPastCutoffTime('10:30') ? 'ABSENT' : 'NOT_MARKED';
      }

      res.json({
        success: true,
        data: {
          date: todayStr,
          displayStatus,
          isCurrentlyWorking,
          officeId: attendance?.officeId || office?.id || null,
          officeName: attendance?.officeName || office?.officeName || null,
          incompletePreviousDay: incompletePreviousAttendance
            ? {
                date: incompletePreviousAttendance.date,
                checkInTime: incompletePreviousAttendance.checkInTime
                  ? formatTime12h(incompletePreviousAttendance.checkInTime)
                  : '—',
              }
            : null,
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
                liveOtMinutes,
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
                id: office.id,
                officeName: attendance?.officeName || office.officeName,
                address: office.address,
                allowedRadiusMeters: office.allowedRadiusMeters,
              }
            : null,
        },
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to retrieve attendance status.' });
    }
  },

  // 3. Employee Check-In via QR Token & GPS Validation
  checkIn: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { qrToken, latitude, longitude, accuracy } = req.body;

    try {
      const employee = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!employee || !employee.isActive) {
        res.status(403).json({ success: false, message: 'Employee account is inactive or not found.' });
        return;
      }

      const todayStr = getTodayDateString();

      // Check Company Leave / Holiday
      const holiday = await prisma.governmentHoliday.findUnique({ where: { date: todayStr } });
      if (holiday) {
        res.status(400).json({
          success: false,
          errorType: 'COMPANY_LEAVE',
          message: 'Today is a company leave day. Attendance check-in is not required.',
          holidayName: holiday.name,
        });
        return;
      }

      // Office Configurations (Multi-office support for all configured locations)
      const configuredOffices = await prisma.officeConfig.findMany({
        orderBy: { slotIndex: 'asc' },
      });
      const offices = configuredOffices.length > 0 ? configuredOffices : [
        {
          id: 'default',
          officeName: 'ECDIAL Headquarters - Coimbatore',
          latitude: 11.0168,
          longitude: 76.9558,
          allowedRadiusMeters: 200.0,
          qrRotationSeconds: 30,
        },
      ];

      // Validate Static Office QR Token
      const isValidToken =
        qrToken &&
        (qrToken === STATIC_OFFICE_QR_TOKEN ||
          qrToken === 'ECDIAL-OFFICE-ATTENDANCE-ACTIVE-SESSION' ||
          (typeof qrToken === 'string' && qrToken.toUpperCase().includes('ECDIAL')));

      if (!isValidToken) {
        res.status(400).json({
          success: false,
          errorType: 'INVALID_QR',
          message: 'Invalid QR code. Please scan the official ECDIAL office attendance QR.',
        });
        return;
      }

      // Validate GPS
      if (latitude === undefined || longitude === undefined || accuracy === undefined) {
        res.status(400).json({
          success: false,
          errorType: 'GPS_UNAVAILABLE',
          message: 'Unable to verify your location. Please enable location permissions and try again.',
        });
        return;
      }

      // Multi-office perimeter verification: Check which configured office the employee is attending
      let matchingOffice: any = null;
      let closestOffice: any = null;
      let minDistance = Infinity;

      for (const off of offices) {
        const geoCheck = isWithinOfficeRadius(
          Number(latitude),
          Number(longitude),
          off.latitude,
          off.longitude,
          off.allowedRadiusMeters
        );
        if (geoCheck.distanceMeters < minDistance) {
          minDistance = geoCheck.distanceMeters;
          closestOffice = { office: off, geo: geoCheck };
        }
        if (geoCheck.isWithin) {
          matchingOffice = { office: off, geo: geoCheck };
          break;
        }
      }

      if (!matchingOffice) {
        res.status(400).json({
          success: false,
          errorType: 'OUT_OF_OFFICE_RADIUS',
          message: `You are outside office perimeter (${minDistance}m from ${closestOffice?.office?.officeName || 'office'}). Must be within ${closestOffice?.office?.allowedRadiusMeters || 200}m.`,
          distanceMeters: minDistance,
          allowedRadiusMeters: closestOffice?.office?.allowedRadiusMeters || 200,
        });
        return;
      }

      const activeOffice = matchingOffice.office;
      const geoResult = matchingOffice.geo;

      // Check existing attendance for today
      const existingAttendance = await prisma.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: todayStr,
          },
        },
      });

      const now = new Date();

      // Case A: Employee is already checked in -> Process Check-out
      if (existingAttendance && existingAttendance.checkInTime) {
        if (!existingAttendance.checkOutTime) {
          const checkInDate = new Date(existingAttendance.checkInTime);
          const durMins = calculateDurationMinutes(checkInDate, now);
          const otMins = calculateOvertimeMinutes(now, '18:00');

          await prisma.attendance.update({
            where: { id: existingAttendance.id },
            data: {
              checkOutTime: now,
              checkOutDistance: geoResult.distanceMeters,
              checkOutGpsAccuracy: Number(accuracy),
              checkOutLatitude: Number(latitude),
              checkOutLongitude: Number(longitude),
              workingDurationMinutes: durMins,
              otMinutes: otMins,
              ...(existingAttendance.officeName ? {} : { officeId: activeOffice.id, officeName: activeOffice.officeName }),
            },
          });

          await prisma.attendanceAuditLog.create({
            data: {
              employeeId: employee.id,
              employeeName: employee.name,
              action: 'CHECK_OUT',
              date: todayStr,
              timestamp: now,
              method: 'QR',
              distance: geoResult.distanceMeters,
              gpsAccuracy: Number(accuracy),
              performedById: employee.id,
              details: JSON.stringify({
                checkInTime: checkInDate.toISOString(),
                checkOutTime: now.toISOString(),
                workingDurationMinutes: durMins,
                office: existingAttendance.officeName || activeOffice.officeName,
              }),
            },
          });

          const checkOutFormatted = formatTime12h(now);
          const durFormatted = formatMinutesToDuration(durMins);

          res.json({
            success: true,
            action: 'CHECK_OUT',
            message: `Checkout Successful ✓\nClosing Time: ${checkOutFormatted}\nOffice: ${existingAttendance.officeName || activeOffice.officeName}\nWorked: ${durFormatted}`,
            data: {
              status: 'COMPLETED',
              checkInTime: formatTime12h(checkInDate),
              checkOutTime: checkOutFormatted,
              workingDuration: durFormatted,
              officeName: existingAttendance.officeName || activeOffice.officeName,
              date: todayStr,
              distanceMeters: geoResult.distanceMeters,
            },
          });
          return;
        } else {
          const existingCheckInTime = formatTime12h(existingAttendance.checkInTime);
          const existingCheckOutTime = formatTime12h(existingAttendance.checkOutTime);
          res.status(400).json({
            success: false,
            errorType: 'DUPLICATE_CHECKIN',
            message: `Attendance completed for today.\nIn: ${existingCheckInTime} | Out: ${existingCheckOutTime}`,
            checkInTime: existingCheckInTime,
            checkOutTime: existingCheckOutTime,
          });
          return;
        }
      }

      // Case B: First Scan of the Day -> Process Check-in
      const dayOfWeek = now.getDay();
      const schedule = await prisma.employeeSchedule.findUnique({
        where: {
          employeeId_dayOfWeek: {
            employeeId: employee.id,
            dayOfWeek,
          },
        },
      });

      // Save to Supabase DB
      await prisma.attendance.upsert({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: todayStr,
          },
        },
        update: {
          checkInTime: now,
          checkInMethod: 'QR',
          checkInDistance: geoResult.distanceMeters,
          checkInGpsAccuracy: Number(accuracy),
          checkInLatitude: Number(latitude),
          checkInLongitude: Number(longitude),
          officeId: activeOffice.id,
          officeName: activeOffice.officeName,
          status: 'PRESENT',
        },
        create: {
          employeeId: employee.id,
          date: todayStr,
          checkInTime: now,
          checkInMethod: 'QR',
          checkInDistance: geoResult.distanceMeters,
          checkInGpsAccuracy: Number(accuracy),
          checkInLatitude: Number(latitude),
          checkInLongitude: Number(longitude),
          officeId: activeOffice.id,
          officeName: activeOffice.officeName,
          status: 'PRESENT',
          notes: schedule && !schedule.isWorkingDay ? 'Present on Weekly Off' : null,
        },
      });

      // Audit Log
      await prisma.attendanceAuditLog.create({
        data: {
          employeeId: employee.id,
          employeeName: employee.name,
          action: 'CHECK_IN',
          date: todayStr,
          timestamp: now,
          method: 'QR',
          distance: geoResult.distanceMeters,
          gpsAccuracy: Number(accuracy),
          performedById: employee.id,
          details: JSON.stringify({ checkInTime: now.toISOString(), office: activeOffice.officeName }),
        },
      });

      const formattedTime = formatTime12h(now);

      res.json({
        success: true,
        action: 'CHECK_IN',
        message: `Attendance Marked ✓\nOffice: ${activeOffice.officeName}`,
        data: {
          status: 'PRESENT',
          checkInTime: formattedTime,
          officeName: activeOffice.officeName,
          officeId: activeOffice.id,
          date: todayStr,
          distanceMeters: geoResult.distanceMeters,
        },
      });
    } catch (err: any) {
      console.error('[CheckIn Error]', err);
      res.status(500).json({ success: false, message: 'Check-in failed. Please try again.' });
    }
  },

  // 4. Employee Check-Out & Overtime Calculation
  checkOut: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { latitude, longitude, accuracy } = req.body;

    try {
      const employee = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employee not found.' });
        return;
      }

      const todayStr = getTodayDateString();
      const attendance = await prisma.attendance.findUnique({
        where: {
          employeeId_date: {
            employeeId: employee.id,
            date: todayStr,
          },
        },
      });

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
      const durationMins = calculateDurationMinutes(new Date(attendance.checkInTime), now);
      const dayOfWeek = now.getDay();

      const schedule = await prisma.employeeSchedule.findUnique({
        where: {
          employeeId_dayOfWeek: {
            employeeId: employee.id,
            dayOfWeek,
          },
        },
      });

      let otMinutes = 0;
      let otStatus = 'NONE';

      if (schedule && schedule.endTime) {
        otMinutes = calculateOvertimeMinutes(now, schedule.endTime);
        if (otMinutes >= 30) {
          otStatus = 'OT_PENDING_APPROVAL';
        }
      }

      // Update in Supabase DB
      const updated = await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
          checkOutTime: now,
          checkOutLatitude: latitude !== undefined ? Number(latitude) : null,
          checkOutLongitude: longitude !== undefined ? Number(longitude) : null,
          checkOutGpsAccuracy: accuracy !== undefined ? Number(accuracy) : null,
          workingDurationMinutes: durationMins,
          otMinutes,
          otStatus,
        },
      });

      // Audit Log
      await prisma.attendanceAuditLog.create({
        data: {
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
        },
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
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Check-out failed.' });
    }
  },

  // 5. Submit Attendance Request (Enforcing Single Active Request Rule)
  submitAttendanceRequest: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    try {
      const employee = await prisma.user.findUnique({ where: { id: req.user.id } });
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employee not found.' });
        return;
      }

      const { requestType, dates, checkInTime, checkOutTime, reason, remarks, closingTime } = req.body;
      const todayStr = getTodayDateString();
      let requestedDates = Array.isArray(dates) && dates.length > 0 ? dates : [todayStr];

      // Enforce ONE ACTIVE REQUEST PER DATE rule
      // If a request for date D is already under review, employee cannot submit another for D,
      // but CAN submit requests for other dates!
      const activeRequests = await prisma.attendanceRequest.findMany({
        where: {
          employeeId: employee.id,
          status: { in: ['WAITING_FOR_APPROVAL', 'UNDER_APPROVAL'] },
        },
      });

      for (const ar of activeRequests) {
        let activeDates: string[] = [];
        try {
          activeDates = typeof ar.dates === 'string' ? JSON.parse(ar.dates) : (ar.dates || []);
        } catch {
          activeDates = [];
        }

        const conflictDate = requestedDates.find((d: string) => activeDates.includes(d));
        if (conflictDate) {
          res.status(400).json({
            success: false,
            errorType: 'ACTIVE_REQUEST_EXISTS_FOR_DATE',
            message: `A request for date (${conflictDate}) is already under review. You cannot submit another request for this date until it is resolved.`,
            activeRequestId: ar.id,
            conflictDate,
          });
          return;
        }
      }

      // Block future date requests (Rule 15)
      for (const d of requestedDates) {
        if (d > todayStr) {
          res.status(400).json({
            success: false,
            errorType: 'FUTURE_DATE_FORBIDDEN',
            message: `Attendance request cannot be submitted for future date (${d}).`,
          });
          return;
        }
      }

      // Block pre-joining date requests (Rule 4)
      const employeeStartDate = employee.createdAt ? employee.createdAt.toISOString().substring(0, 10) : '2026-01-01';

      for (const d of requestedDates) {
        if (d < employeeStartDate) {
          res.status(400).json({
            success: false,
            errorType: 'PRE_JOINING_DATE_FORBIDDEN',
            message: `Cannot request attendance for date (${d}) prior to joining date (${employeeStartDate}).`,
          });
          return;
        }
      }

      if (!reason || reason.trim() === '') {
        res.status(400).json({ success: false, message: 'Please provide a reason for the attendance request.' });
        return;
      }

      let finalType = requestType || 'MISSED_ATTENDANCE';
      let finalCheckIn = checkInTime || '09:00';
      let finalCheckOut = checkOutTime || null;

      if (finalType === 'TODAY_ATTENDANCE' || (requestedDates.includes(todayStr) && !checkOutTime)) {
        finalType = 'TODAY_ATTENDANCE';
        finalCheckOut = null;
      } else if (finalType === 'CLOSING_REQUEST' || finalType === 'EARLY_CHECKOUT') {
        finalCheckOut = closingTime || checkOutTime || '18:00';
      } else if (requestedDates.length > 1) {
        finalType = 'MULTI_DAY_MISSED';
        finalCheckOut = checkOutTime || '18:00';
      }

      const newRequest = await prisma.attendanceRequest.create({
        data: {
          employeeId: employee.id,
          requestType: finalType,
          dates: JSON.stringify(requestedDates),
          checkInTime: finalCheckIn,
          checkOutTime: finalCheckOut,
          reason: reason.trim(),
          remarks: remarks ? remarks.trim() : null,
          status: 'UNDER_APPROVAL',
        },
      });

      await prisma.attendanceAuditLog.create({
        data: {
          employeeId: employee.id,
          employeeName: employee.name,
          action: 'REQUEST_SUBMITTED',
          date: requestedDates[0],
          timestamp: new Date(),
          method: 'MANUAL_REQUEST',
          performedById: employee.id,
          details: JSON.stringify({ dates: requestedDates, requestType: finalType, reason }),
        },
      });

      // Notify Admins asynchronously via push and in-app
      notificationService.notifyAdminsOfAttendanceRequest({
        employeeId: employee.id,
        employeeName: employee.name,
        requestId: newRequest.id,
        dates: requestedDates,
        requestType: finalType,
      }).catch((err) => console.error('[Notify Admins Error]', err));

      res.json({
        success: true,
        message: 'Attendance request submitted successfully. Status: UNDER APPROVAL.',
        data: newRequest,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to submit request.' });
    }
  },

  // 6. Get Monthly Visual Calendar (Strict Real DB Records)
  getMonthlyCalendar: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const employeeId = (req.query.employeeId as string) || req.user.id;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || new Date().getMonth() + 1;

    try {
      const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
      const daysInMonth = new Date(year, month, 0).getDate();

      // Fetch all DB attendances for this employee in this month
      const attendances = await prisma.attendance.findMany({
        where: {
          employeeId,
          date: { startsWith: monthPrefix },
        },
      });

      // Fetch all schedules for this employee
      const schedules = await prisma.employeeSchedule.findMany({
        where: { employeeId },
      });

      // Fetch all holidays in this month
      const holidays = await prisma.governmentHoliday.findMany({
        where: { date: { startsWith: monthPrefix } },
      });

      // Fetch all requests
      const requests = await prisma.attendanceRequest.findMany({
        where: {
          employeeId,
          status: { in: ['WAITING_FOR_APPROVAL', 'UNDER_APPROVAL'] },
        },
      });

      const calendarDays = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const d = new Date(year, month - 1, day);
        const dayOfWeek = d.getDay();

        const schedule = schedules.find((s) => s.dayOfWeek === dayOfWeek);
        const isWorkingDay = schedule ? schedule.isWorkingDay : dayOfWeek !== 0;
        const holiday = holidays.find((h) => h.date === dateStr);
        const attendance = attendances.find((a) => a.date === dateStr);

        const pendingRequest = requests.find((r) => {
          try {
            const parsed = typeof r.dates === 'string' ? JSON.parse(r.dates) : r.dates;
            return Array.isArray(parsed) && parsed.includes(dateStr);
          } catch {
            return false;
          }
        });

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
          } else if (attendance.status === 'ABSENT') {
            status = 'ABSENT';
            symbol = '×';
            colorCode = 'RED';
            badge = 'ABSENT';
          }
        } else if (pendingRequest) {
          status = 'UNDER_APPROVAL';
          symbol = '⏳';
          colorCode = 'YELLOW';
          badge = 'UNDER_APPROVAL';
        } else if (!isWorkingDay) {
          status = 'WEEKLY_OFF';
          symbol = '—';
          colorCode = 'GREY';
          badge = 'OFF';
        } else {
          // Clean baseline: No record exists in database
          status = 'NOT_MARKED';
          symbol = '—';
          colorCode = 'GREY';
          badge = '';
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

      const employee = await prisma.user.findUnique({ where: { id: employeeId } });
      const employeeStartDate = employee?.createdAt ? employee.createdAt.toISOString().substring(0, 10) : '2026-01-01';

      res.json({
        success: true,
        data: {
          year,
          month,
          employeeStartDate,
          days: calendarDays,
        },
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to retrieve calendar.' });
    }
  },

  // 7. Admin Daily Overview Dashboard (Real Aggregate Counts)
  getTodayDashboard: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const todayStr = (req.query.date as string) || getTodayDateString();
    const roleFilter = req.query.role as string;
    const statusFilter = req.query.status as string;
    const searchFilter = (req.query.search as string)?.toLowerCase();

    try {
      const users = await prisma.user.findMany({
        where: {
          isActive: true,
          ...(roleFilter ? { role: (roleFilter as any) } : { role: { not: 'ADMIN' } }),
          ...(searchFilter
            ? {
                OR: [
                  { name: { contains: searchFilter, mode: 'insensitive' as any } },
                  { employeeCode: { contains: searchFilter, mode: 'insensitive' as any } },
                ],
              }
            : {}),
        },
        include: {
          schedules: true,
        },
        orderBy: { name: 'asc' },
      });

      const todayDate = new Date(todayStr);
      const dayOfWeek = todayDate.getDay();
      const holiday = await prisma.governmentHoliday.findUnique({ where: { date: todayStr } });

      const todayAttendances = await prisma.attendance.findMany({
        where: { date: todayStr },
      });

      const todayRequests = await prisma.attendanceRequest.findMany({
        where: { status: { in: ['WAITING_FOR_APPROVAL', 'UNDER_APPROVAL'] } },
      });

      let presentCount = 0;
      let absentCount = 0;
      let notMarkedCount = 0;
      let currentlyWorkingCount = 0;
      let pendingCount = 0;

      const realTodayStr = getTodayDateString();
      const isPastDate = todayStr < realTodayStr;

      const employeeRows = users.map((employee) => {
        const schedule = employee.schedules.find((s) => s.dayOfWeek === dayOfWeek);
        const isWorkingDay = schedule ? schedule.isWorkingDay : dayOfWeek !== 0;

        const attendance = todayAttendances.find((a) => a.employeeId === employee.id);
        const pendingRequest = todayRequests.find((r) => {
          try {
            const parsed = typeof r.dates === 'string' ? JSON.parse(r.dates) : r.dates;
            return r.employeeId === employee.id && Array.isArray(parsed) && parsed.includes(todayStr);
          } catch {
            return false;
          }
        });

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
              const currentDur = attendance.checkInTime
                ? calculateDurationMinutes(new Date(attendance.checkInTime), new Date())
                : 0;
              durationFormatted = formatMinutesToDuration(currentDur);
            }
          } else if (attendance.status === 'HALF_DAY') {
            status = 'HALF_DAY';
            statusBadge = '½ Half Day';
          } else if (attendance.status === 'ABSENT') {
            absentCount++;
            status = 'ABSENT';
            statusBadge = '× Absent';
          }
        } else if (pendingRequest) {
          pendingCount++;
          status = 'UNDER_APPROVAL';
          statusBadge = '⏳ Under Approval';
        } else if (!isWorkingDay) {
          status = 'WEEKLY_OFF';
          statusBadge = 'Scheduled Day Off';
        } else if (isPastDate || isPastCutoffTime('10:30')) {
          // Past dates or today after 10:30 AM cutoff with no record are marked ABSENT
          absentCount++;
          status = 'ABSENT';
          statusBadge = '× Absent';
        } else {
          notMarkedCount++;
          status = 'NOT_MARKED';
          statusBadge = '— Not Marked';
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
          officeId: attendance?.officeId || null,
          officeName: attendance?.officeName || null,
          otMinutes: attendance?.otMinutes || 0,
          otStatus: attendance?.otStatus || 'NONE',
          attendanceId: attendance?.id || null,
          schedule: schedule ? `${schedule.startTime} - ${schedule.endTime}` : '09:00 - 18:00',
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
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Failed to retrieve dashboard.' });
    }
  },

  // 10. Export Today's Attendance in Excel (.xlsx) (Admin Only)
  exportTodayExcel: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const targetDate = (req.query.date as string) || getTodayDateString();
    try {
      const excelBuffer = await exportService.generateTodayAttendanceExcel(targetDate);
      const filename = `ECDIAL_Attendance_Today_${targetDate}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);
      res.send(excelBuffer);
    } catch (err: any) {
      console.error('[Export Today Excel Error]', err);
      res.status(500).json({ success: false, message: 'Failed to generate Excel report for today.' });
    }
  },

  // 11. Export Overall Monthly Attendance in Excel (.xlsx) (Admin Only)
  exportMonthlyExcel: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month as string, 10) || new Date().getMonth() + 1;
    const monthStr = String(month).padStart(2, '0');

    try {
      const excelBuffer = await exportService.generateMonthlyAttendanceExcel(year, month);
      const filename = `ECDIAL_Attendance_Month_${year}-${monthStr}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', excelBuffer.length);
      res.send(excelBuffer);
    } catch (err: any) {
      console.error('[Export Month Excel Error]', err);
      res.status(500).json({ success: false, message: 'Failed to generate Monthly Excel report.' });
    }
  },

  // 12. Get Current Employee's Submitted Requests with SLA status
  getMyAttendanceRequests: async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    try {
      const requests = await prisma.attendanceRequest.findMany({
        where: { employeeId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      const SLA_HOURS = 5;
      const formatted = requests.map((r) => {
        let datesArr: string[] = [];
        try {
          datesArr = typeof r.dates === 'string' ? JSON.parse(r.dates) : (r.dates || []);
        } catch {
          datesArr = [];
        }

        const createdTime = new Date(r.createdAt).getTime();
        const slaDeadline = new Date(createdTime + SLA_HOURS * 60 * 60 * 1000);
        const isPending = r.status === 'WAITING_FOR_APPROVAL' || r.status === 'UNDER_APPROVAL';

        return {
          ...r,
          parsedDates: datesArr,
          slaHours: SLA_HOURS,
          slaDeadline: slaDeadline.toISOString(),
          isPending,
        };
      });

      res.json({
        success: true,
        data: formatted,
        slaHours: SLA_HOURS,
      });
    } catch (err: any) {
      console.error('[Get My Requests Error]', err);
      res.status(500).json({ success: false, message: 'Failed to retrieve attendance requests.' });
    }
  },
};
