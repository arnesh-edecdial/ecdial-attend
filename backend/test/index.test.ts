import { calculateHaversineDistance, isWithinOfficeRadius } from '../src/utils/geo';
import { generateRotatingQRToken, validateRotatingQRToken } from '../src/utils/crypto';
import {
  calculateQuotationTotals,
  calculateDurationMinutes,
  calculateOvertimeMinutes,
  roundCurrency,
} from '../src/utils/calculations';

function runTests() {
  console.log('--- Starting ECDIAL Automated Verification Tests ---');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Geofence & Haversine Distance Tests
  const officeLat = 13.0827;
  const officeLon = 80.2707;
  const closeLat = 13.0829;
  const closeLon = 80.2709;
  const farLat = 13.0950;
  const farLon = 80.2900;

  const closeDist = calculateHaversineDistance(closeLat, closeLon, officeLat, officeLon);
  assert(closeDist < 50, `Close distance should be < 50m (Calculated: ${closeDist}m)`);

  const closeCheck = isWithinOfficeRadius(closeLat, closeLon, officeLat, officeLon, 100);
  assert(closeCheck.isWithin === true, 'Close point is within 100m radius');

  const farCheck = isWithinOfficeRadius(farLat, farLon, officeLat, officeLon, 100);
  assert(farCheck.isWithin === false, 'Far point (>1km) is correctly rejected outside 100m radius');

  // 2. Rotating QR Token Security Tests
  const todayStr = '2026-08-25';
  const qr = generateRotatingQRToken(todayStr, 30);
  assert(typeof qr.token === 'string' && qr.token.length > 20, 'QR token generated successfully');

  const validCheck = validateRotatingQRToken(qr.token, todayStr, 30);
  assert(validCheck.isValid === true, 'Fresh QR token validates successfully for today');

  const wrongDateCheck = validateRotatingQRToken(qr.token, '2026-08-26', 30);
  assert(wrongDateCheck.isValid === false, 'QR token rejected for mismatched date session');

  const tamperedToken = qr.token.substring(0, qr.token.length - 4) + 'abcd';
  const tamperedCheck = validateRotatingQRToken(tamperedToken, todayStr, 30);
  assert(tamperedCheck.isValid === false, 'Tampered QR signature is correctly rejected');

  // 3. Financial & Quotation Calculation Tests
  const sampleItems = [
    { section: 'MAIN_UNIT', quantity: 1, unitPrice: 30423.73 },
    { section: 'LOW_SIDE', quantity: 1, unitPrice: 1500.00 },
    { section: 'LOW_SIDE', quantity: 1, unitPrice: 1280.00 },
    { section: 'LOW_SIDE', quantity: 1, unitPrice: 730.00 },
  ];

  const totalsWithLowSide = calculateQuotationTotals(sampleItems, true, 9.0, 9.0);
  assert(totalsWithLowSide.mainUnitTotal === 30423.73, `Main unit total is 30423.73 (Got: ${totalsWithLowSide.mainUnitTotal})`);
  assert(totalsWithLowSide.lowSideTotal === 3510.00, `Low side total is 3510.00 (Got: ${totalsWithLowSide.lowSideTotal})`);
  assert(totalsWithLowSide.subtotal === 33933.73, `Subtotal is 33933.73 (Got: ${totalsWithLowSide.subtotal})`);
  assert(totalsWithLowSide.cgstAmount === 3054.04, `CGST 9% is 3054.04 (Got: ${totalsWithLowSide.cgstAmount})`);
  assert(totalsWithLowSide.sgstAmount === 3054.04, `SGST 9% is 3054.04 (Got: ${totalsWithLowSide.sgstAmount})`);
  assert(totalsWithLowSide.grandTotal === 40041.81, `Grand total is 40041.81 (Got: ${totalsWithLowSide.grandTotal})`);

  const totalsWithoutLowSide = calculateQuotationTotals(sampleItems, false, 9.0, 9.0);
  assert(totalsWithoutLowSide.lowSideTotal === 0, 'Low-side total is 0 when low-side toggle is OFF');
  assert(totalsWithoutLowSide.subtotal === 30423.73, 'Subtotal equals Main Unit Total when low-side is OFF');

  // 4. Overtime & Duration Tests
  const start = new Date('2026-08-25T09:04:00');
  const end = new Date('2026-08-25T20:15:00');
  const duration = calculateDurationMinutes(start, end);
  assert(duration === 671, `Duration is 671 minutes (11h 11m) (Got: ${duration})`);

  const otMins = calculateOvertimeMinutes(end, '18:00');
  assert(otMins === 135, `Overtime from 18:00 to 20:15 is 135 minutes (2h 15m) (Got: ${otMins})`);

  const normalCheckout = new Date('2026-08-25T17:45:00');
  const zeroOt = calculateOvertimeMinutes(normalCheckout, '18:00');
  assert(zeroOt === 0, `No overtime when checking out before 18:00 (Got: ${zeroOt})`);

  console.log(`----------------------------------------------------`);
  console.log(`Test Results: ${passed} passed, ${failed} failed.`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
