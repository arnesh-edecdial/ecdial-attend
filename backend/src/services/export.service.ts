import ExcelJS from 'exceljs';
import { prisma } from '../db/store';
import {
  calculateDurationMinutes,
  formatMinutesToDuration,
  formatTime12h,
  getTodayDateString,
  isPastCutoffTime,
} from '../utils/calculations';

function formatFullDateTime(d?: Date | string | null): string {
  if (!d) return '—';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return '—';
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}/${month}/${year} ${formatTime12h(dt)}`;
}

export const exportService = {
  /**
   * 1. Generate Today's Attendance Excel Report (.xlsx)
   */
  generateTodayAttendanceExcel: async (dateStr?: string): Promise<Buffer> => {
    const targetDateStr = dateStr || getTodayDateString();
    const d = new Date(targetDateStr);
    const dayOfWeek = d.getDay();

    // Fetch all active employees
    const employees = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        schedules: true,
      },
      orderBy: { name: 'asc' },
    });

    // Fetch attendances for today
    const attendances = await prisma.attendance.findMany({
      where: { date: targetDateStr },
    });

    // Fetch holiday
    const holiday = await prisma.governmentHoliday.findUnique({
      where: { date: targetDateStr },
    });

    // Fetch pending requests
    const requests = await prisma.attendanceRequest.findMany({
      where: { status: { in: ['WAITING_FOR_APPROVAL', 'UNDER_APPROVAL'] } },
    });

    // Initialize Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ECDIAL Attendance System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Daily Attendance', {
      views: [{ showGridLines: true }],
    });

    // 1. Company Header Banner
    sheet.mergeCells('A1:J1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'ECDIAL AC SERVICES & SOLUTIONS';
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0A1E3F' },
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 32;

    sheet.mergeCells('A2:J2');
    const subTitleCell = sheet.getCell('A2');
    subTitleCell.value = `DAILY ATTENDANCE REPORT — ${targetDateStr} ${holiday ? `(Holiday: ${holiday.name})` : ''}`;
    subTitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0066CC' } };
    subTitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEBF5FF' },
    };
    subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 24;

    sheet.addRow([]); // Blank line

    // 2. Table Headers
    const headers = [
      'S.No',
      'Employee Code',
      'Employee Name',
      'Department',
      'Role',
      'Status',
      'Check-In Time',
      'Check-Out Time',
      'Work Duration',
      'Overtime',
      'Office Location',
    ];

    const headerRow = sheet.addRow(headers);
    headerRow.height = 26;

    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0052A3' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF0A1E3F' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });

    let presentCount = 0;
    let absentCount = 0;
    let notMarkedCount = 0;

    // 3. Employee Rows
    employees.forEach((emp, index) => {
      const schedule = emp.schedules.find((s) => s.dayOfWeek === dayOfWeek);
      const isWorkingDay = schedule ? schedule.isWorkingDay : dayOfWeek !== 0;
      const att = attendances.find((a) => a.employeeId === emp.id);

      const pendingRequest = requests.find((r) => {
        try {
          const parsed = typeof r.dates === 'string' ? JSON.parse(r.dates) : r.dates;
          return r.employeeId === emp.id && Array.isArray(parsed) && parsed.includes(targetDateStr);
        } catch {
          return false;
        }
      });

      let status = 'NOT_MARKED';
      let checkIn = '—';
      let checkOut = '—';
      let duration = '—';
      let overtime = '—';

      if (holiday) {
        status = `LEAVE (${holiday.name})`;
      } else if (att) {
        if (att.status === 'PRESENT') {
          presentCount++;
          checkIn = att.checkInTime ? formatTime12h(att.checkInTime) : '—';
          checkOut = att.checkOutTime ? formatTime12h(att.checkOutTime) : 'Working';
          if (att.checkOutTime) {
            status = 'COMPLETED';
            duration = att.workingDurationMinutes
              ? formatMinutesToDuration(att.workingDurationMinutes)
              : '—';
          } else {
            status = 'PRESENT (Working)';
            const dur = att.checkInTime
              ? calculateDurationMinutes(new Date(att.checkInTime), new Date())
              : 0;
            duration = formatMinutesToDuration(dur);
          }
          if (att.otMinutes && att.otMinutes > 0) {
            overtime = `${att.otMinutes} mins (${att.otStatus})`;
          }
        } else if (att.status === 'HALF_DAY') {
          status = 'HALF_DAY';
          checkIn = att.checkInTime ? formatTime12h(att.checkInTime) : '—';
          checkOut = att.checkOutTime ? formatTime12h(att.checkOutTime) : '—';
        } else if (att.status === 'ABSENT') {
          absentCount++;
          status = 'ABSENT';
        }
      } else if (pendingRequest) {
        status = 'UNDER_APPROVAL';
      } else if (!isWorkingDay) {
        status = 'WEEKLY_OFF';
      } else if (targetDateStr < getTodayDateString() || isPastCutoffTime('10:30')) {
        absentCount++;
        status = 'ABSENT';
      } else {
        notMarkedCount++;
        status = 'NOT_MARKED';
      }

      const row = sheet.addRow([
        index + 1,
        emp.employeeCode,
        emp.name,
        emp.department || 'HVAC Operations',
        emp.role,
        status,
        checkIn,
        checkOut,
        duration,
        overtime,
        att?.officeName || '—',
      ]);

      row.height = 22;

      // Cell Styling
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10.5 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 1 ? 'center' : colNumber === 6 ? 'center' : 'left',
        };

        // Alternating row background
        if (index % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        }

        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });

      // Status color highlighting
      const statusCell = row.getCell(6);
      if (status.includes('PRESENT') || status === 'COMPLETED') {
        statusCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF065F46' } };
      } else if (status === 'ABSENT') {
        statusCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFDC2626' } };
      } else if (status === 'UNDER_APPROVAL') {
        statusCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFD97706' } };
      }
    });

    // 4. Auto Column Widths
    sheet.columns = [
      { width: 8 },  // S.No
      { width: 16 }, // Employee Code
      { width: 26 }, // Employee Name
      { width: 24 }, // Department
      { width: 16 }, // Role
      { width: 20 }, // Status
      { width: 16 }, // Check-In
      { width: 16 }, // Check-Out
      { width: 16 }, // Duration
      { width: 20 }, // Overtime
    ];

    sheet.addRow([]); // Blank line

    // 5. Summary Footer
    const summaryRow = sheet.addRow([
      '',
      'SUMMARY:',
      `Total Staff: ${employees.length}`,
      `Present: ${presentCount}`,
      `Absent: ${absentCount}`,
      `Not Marked: ${notMarkedCount}`,
    ]);
    summaryRow.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0A1E3F' } };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },

  /**
   * 2. Generate Overall Monthly Attendance Excel Report (.xlsx)
   */
  generateMonthlyAttendanceExcel: async (year: number, month: number): Promise<Buffer> => {
    const monthPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[month - 1] || `Month ${month}`;

    // Fetch all active employees
    const employees = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        schedules: true,
      },
      orderBy: { name: 'asc' },
    });

    // Fetch all attendances for the entire month
    const attendances = await prisma.attendance.findMany({
      where: {
        date: { startsWith: monthPrefix },
      },
    });

    // Fetch all holidays in this month
    const holidays = await prisma.governmentHoliday.findMany({
      where: { date: { startsWith: monthPrefix } },
    });

    // Initialize Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ECDIAL Attendance System';
    workbook.created = new Date();

    // ==========================================
    // SHEET 1: MONTHLY SUMMARY
    // ==========================================
    const summarySheet = workbook.addWorksheet('Monthly Summary', {
      views: [{ showGridLines: true }],
    });

    // Header Title
    summarySheet.mergeCells('A1:L1');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'ECDIAL AC SERVICES & SOLUTIONS';
    titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0A1E3F' },
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(1).height = 32;

    summarySheet.mergeCells('A2:L2');
    const subTitleCell = summarySheet.getCell('A2');
    subTitleCell.value = `MONTHLY ATTENDANCE SUMMARY — ${monthName.toUpperCase()} ${year} (Total Days: ${daysInMonth})`;
    subTitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0066CC' } };
    subTitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEBF5FF' },
    };
    subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    summarySheet.getRow(2).height = 24;

    summarySheet.addRow([]); // Blank

    // Summary Table Headers
    const summaryHeaders = [
      'S.No',
      'Employee Code',
      'Employee Name',
      'Department',
      'Role',
      'Working Days',
      'Present Days',
      'Absent Days',
      'Half Days',
      'Holidays / Leave',
      'Total Work Hours',
      'Total Overtime (OT)',
      'Attendance %',
    ];

    const sumHeaderRow = summarySheet.addRow(summaryHeaders);
    sumHeaderRow.height = 26;

    sumHeaderRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0052A3' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF0A1E3F' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });

    // Populate each employee summary
    employees.forEach((emp, idx) => {
      const empAttendances = attendances.filter((a) => a.employeeId === emp.id);

      let presentDays = 0;
      let absentDays = 0;
      let halfDays = 0;
      let workingDaysCount = 0;
      let totalWorkMinutes = 0;
      let totalOtMinutes = 0;

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const dayDate = new Date(year, month - 1, day);
        const dayOfWeek = dayDate.getDay();

        const schedule = emp.schedules.find((s) => s.dayOfWeek === dayOfWeek);
        const isWorkingDay = schedule ? schedule.isWorkingDay : dayOfWeek !== 0;
        const isHoliday = holidays.some((h) => h.date === dateStr);

        if (isWorkingDay && !isHoliday) {
          workingDaysCount++;
        }

        const att = empAttendances.find((a) => a.date === dateStr);
        if (att) {
          if (att.status === 'PRESENT') {
            presentDays++;
            totalWorkMinutes += att.workingDurationMinutes || 480; // default 8 hrs if not closed
          } else if (att.status === 'HALF_DAY') {
            halfDays++;
            totalWorkMinutes += att.workingDurationMinutes || 240;
          } else if (att.status === 'ABSENT') {
            absentDays++;
          }
          if (att.otMinutes && att.otMinutes > 0) {
            totalOtMinutes += att.otMinutes;
          }
        }
      }

      const totalWorkHours = (totalWorkMinutes / 60).toFixed(1);
      const effectivePresent = presentDays + halfDays * 0.5;
      const attendancePercent =
        workingDaysCount > 0 ? Math.round((effectivePresent / workingDaysCount) * 100) : 100;

      const row = summarySheet.addRow([
        idx + 1,
        emp.employeeCode,
        emp.name,
        emp.department || 'HVAC Operations',
        emp.role,
        workingDaysCount,
        presentDays,
        absentDays,
        halfDays,
        holidays.length,
        `${totalWorkHours} hrs`,
        totalOtMinutes > 0 ? `${(totalOtMinutes / 60).toFixed(1)} hrs (${totalOtMinutes} mins)` : '0 mins',
        `${attendancePercent}%`,
      ]);

      row.height = 22;

      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Calibri', size: 10.5 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNumber === 1 || colNumber >= 6 ? 'center' : 'left',
        };

        if (idx % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' },
          };
        }

        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      });

      // Attendance percentage color highlight
      const pctCell = row.getCell(13);
      if (attendancePercent >= 90) {
        pctCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF065F46' } };
      } else if (attendancePercent < 75) {
        pctCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFDC2626' } };
      }
    });

    summarySheet.columns = [
      { width: 8 },  // S.No
      { width: 16 }, // Employee Code
      { width: 26 }, // Name
      { width: 22 }, // Department
      { width: 16 }, // Role
      { width: 15 }, // Working Days
      { width: 14 }, // Present Days
      { width: 14 }, // Absent Days
      { width: 12 }, // Half Days
      { width: 16 }, // Holidays
      { width: 18 }, // Total Work Hours
      { width: 20 }, // Total OT
      { width: 16 }, // Attendance %
    ];

    // ==========================================
    // SHEET 2: DETAILED DAILY LOGS (Date, Login DateTime, Logout DateTime, Working Time, OT)
    // ==========================================
    const detailSheet = workbook.addWorksheet('Daily Logs', {
      views: [{ showGridLines: true }],
    });

    detailSheet.mergeCells('A1:L1');
    const logTitle = detailSheet.getCell('A1');
    logTitle.value = `ECDIAL DAILY ATTENDANCE LOGS — ${monthName.toUpperCase()} ${year}`;
    logTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    logTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1E3F' } };
    logTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    detailSheet.getRow(1).height = 28;

    detailSheet.addRow([]); // Blank

    const detailHeaders = [
      'Date',
      'Day',
      'Employee Code',
      'Employee Name',
      'Department',
      'Role',
      'Status',
      'Login Date & Time',
      'Logout Date & Time',
      'Working Time',
      'Overtime (OT)',
      'OT Status',
    ];

    const detailHeaderRow = detailSheet.addRow(detailHeaders);
    detailHeaderRow.height = 24;

    detailHeaderRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0052A3' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'medium', color: { argb: 'FF0A1E3F' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });

    const dayShortNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayDate = new Date(year, month - 1, day);
      const dayName = dayShortNames[dayDate.getDay()];
      const isHoliday = holidays.find((h) => h.date === dateStr);

      employees.forEach((emp) => {
        const schedule = emp.schedules.find((s) => s.dayOfWeek === dayDate.getDay());
        const isWorkingDay = schedule ? schedule.isWorkingDay : dayDate.getDay() !== 0;
        const att = attendances.find((a) => a.employeeId === emp.id && a.date === dateStr);

        let status = 'NOT_MARKED';
        let loginDateTime = '—';
        let logoutDateTime = '—';
        let duration = '—';
        let overtime = '—';
        let otStatus = '—';

        if (isHoliday) {
          status = `HOLIDAY (${isHoliday.name})`;
        } else if (att) {
          status = att.status;
          loginDateTime = att.checkInTime ? formatFullDateTime(att.checkInTime) : '—';
          logoutDateTime = att.checkOutTime ? formatFullDateTime(att.checkOutTime) : (att.status === 'PRESENT' ? 'Currently Working' : '—');
          duration = att.workingDurationMinutes ? formatMinutesToDuration(att.workingDurationMinutes) : '—';
          if (att.otMinutes && att.otMinutes > 0) {
            overtime = `${att.otMinutes} mins (${formatMinutesToDuration(att.otMinutes)})`;
            otStatus = att.otStatus || 'APPROVED';
          }
        } else if (!isWorkingDay) {
          status = 'WEEKLY_OFF';
        }

        const logRow = detailSheet.addRow([
          dateStr,
          dayName,
          emp.employeeCode,
          emp.name,
          emp.department || 'HVAC Operations',
          emp.role,
          status,
          loginDateTime,
          logoutDateTime,
          duration,
          overtime,
          otStatus,
        ]);

        logRow.height = 20;

        logRow.eachCell((cell, colNumber) => {
          cell.font = { name: 'Calibri', size: 10 };
          cell.alignment = {
            vertical: 'middle',
            horizontal: colNumber <= 2 || colNumber === 7 ? 'center' : 'left',
          };
        });
      });
    }

    detailSheet.columns = [
      { width: 14 }, // Date
      { width: 8 },  // Day
      { width: 16 }, // Employee Code
      { width: 24 }, // Name
      { width: 20 }, // Department
      { width: 15 }, // Role
      { width: 18 }, // Status
      { width: 24 }, // Login Date & Time
      { width: 24 }, // Logout Date & Time
      { width: 16 }, // Working Time
      { width: 20 }, // Overtime
      { width: 14 }, // OT Status
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },
};
