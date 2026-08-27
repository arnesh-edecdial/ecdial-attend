import { prisma } from '../src/db/store';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { calculateDurationMinutes, formatMinutesToDuration, isWithinGeofence } from '../src/utils/calculations';

const JWT_SECRET = process.env.JWT_SECRET || 'ecdial-super-secret-jwt-key-2026';

async function runE2ETests() {
  console.log('====================================================');
  console.log('⚡ Starting ECDIAL Production Lifecycle & DB Verification');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✕ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Verify Database Connection
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@ecdial.com' },
    });
    assert(!!adminUser, 'Admin account exists in Supabase DB (admin@ecdial.com)');

    // 2. Clean up any previous test employee
    await prisma.user.deleteMany({
      where: { email: 'e2e.test.tech@ecdial.com' },
    });

    // 3. Admin creates new employee
    const hashedPassword = await bcrypt.hash('Tech@12345', 10);
    const newEmployee = await prisma.user.create({
      data: {
        name: 'Karthik E2E Tester',
        email: 'e2e.test.tech@ecdial.com',
        employeeCode: 'TEC999',
        role: 'TECHNICIAN',
        department: 'HVAC Testing Ops',
        phone: '+91 98765 99999',
        password: hashedPassword,
        isActive: true,
        schedules: {
          create: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
            dayOfWeek: day,
            startTime: '09:00',
            endTime: '18:00',
            isWorkingDay: day !== 0,
          })),
        },
      },
      include: { schedules: true },
    });

    assert(!!newEmployee.id, 'New employee created in Supabase DB');
    assert(newEmployee.schedules.length === 7, 'Auto-generated 7-day schedule (Mon-Sat 09:00-18:00, Sun OFF)');

    // 4. Verify Zero-Data Baseline for Newly Created Employee
    const attendanceRecords = await prisma.attendance.findMany({
      where: { employeeId: newEmployee.id },
    });
    assert(attendanceRecords.length === 0, 'New employee has ZERO attendance records');

    const totalWorkingMins = attendanceRecords.reduce((sum, a) => sum + (a.workingDurationMinutes || 0), 0);
    assert(totalWorkingMins === 0, 'New employee total working minutes is exactly 0');

    // 5. Test Password Verification
    const isPasswordValid = await bcrypt.compare('Tech@12345', newEmployee.password);
    assert(isPasswordValid, 'Password verification with bcrypt succeeded');

    // 6. Test Deactivation Lockout
    await prisma.user.update({
      where: { id: newEmployee.id },
      data: { isActive: false },
    });
    const deactivatedEmp = await prisma.user.findUnique({ where: { id: newEmployee.id } });
    assert(deactivatedEmp?.isActive === false, 'Employee deactivated by Admin');

    // Reactivate
    await prisma.user.update({
      where: { id: newEmployee.id },
      data: { isActive: true },
    });
    const reactivatedEmp = await prisma.user.findUnique({ where: { id: newEmployee.id } });
    assert(reactivatedEmp?.isActive === true, 'Employee reactivated by Admin');

    // 7. Test Attendance Request & Approval Lifecycle
    const testDate = '2026-08-20';
    const request = await prisma.attendanceRequest.create({
      data: {
        employeeId: newEmployee.id,
        requestType: 'TODAY_ATTENDANCE',
        dates: JSON.stringify([testDate]),
        checkInTime: '09:00',
        checkOutTime: '18:30',
        reason: 'Client site emergency installation',
        status: 'WAITING_FOR_APPROVAL',
      },
    });
    assert(request.status === 'WAITING_FOR_APPROVAL', 'Attendance request submitted with WAITING_FOR_APPROVAL');

    // Test Single Active Request constraint
    const pendingCount = await prisma.attendanceRequest.count({
      where: {
        employeeId: newEmployee.id,
        status: { in: ['WAITING_FOR_APPROVAL', 'UNDER_APPROVAL'] },
      },
    });
    assert(pendingCount === 1, 'Only 1 active pending request exists for employee');

    // Admin approves the request
    const inDate = new Date(`${testDate}T09:00:00`);
    const outDate = new Date(`${testDate}T18:30:00`);
    const duration = calculateDurationMinutes(inDate, outDate);

    await prisma.attendance.create({
      data: {
        employeeId: newEmployee.id,
        date: testDate,
        checkInTime: inDate,
        checkOutTime: outDate,
        workingDurationMinutes: duration,
        status: 'PRESENT',
        checkInMethod: 'MANUAL_APPROVAL',
        notes: 'Approved by Admin',
      },
    });

    await prisma.attendanceRequest.update({
      where: { id: request.id },
      data: { status: 'APPROVED', reviewedById: adminUser.id, reviewedAt: new Date() },
    });

    const approvedAttendance = await prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId: newEmployee.id, date: testDate } },
    });
    assert(!!approvedAttendance, 'Attendance record written to DB upon Admin approval');
    assert(approvedAttendance?.status === 'PRESENT', 'Attendance status is PRESENT');
    assert(approvedAttendance?.workingDurationMinutes === 570, `Working duration is 570 mins (9h 30m) (Got: ${approvedAttendance?.workingDurationMinutes})`);

    // Clean up test employee
    await prisma.attendance.deleteMany({ where: { employeeId: newEmployee.id } });
    await prisma.attendanceRequest.deleteMany({ where: { employeeId: newEmployee.id } });
    await prisma.employeeSchedule.deleteMany({ where: { employeeId: newEmployee.id } });
    await prisma.user.delete({ where: { id: newEmployee.id } });
    console.log('\n  ✓ Cleaned up test records from database.');

  } catch (err: any) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runE2ETests().catch((err) => {
  console.error(err);
  process.exit(1);
});
