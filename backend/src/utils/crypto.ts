import crypto from 'crypto';

const QR_SECRET = process.env.QR_SECRET || 'ecdial_qr_rotation_secret_key_2026';

export interface QRTokenData {
  sessionId: string;
  date: string;       // YYYY-MM-DD
  timeWindow: number; // Unix timestamp / rotation interval
  nonce: string;
  signature: string;
}

/**
 * Generate a rotating QR token for a given date and time window
 */
export function generateRotatingQRToken(
  dateStr: string,
  rotationSeconds: number = 30
): { token: string; expiresAt: number; timeWindow: number; secondsRemaining: number } {
  const now = Date.now();
  const timeWindow = Math.floor(now / (rotationSeconds * 1000));
  const sessionId = `ECD-ATT-${dateStr}`;
  const nonce = crypto.randomBytes(4).toString('hex');

  const payload = `${sessionId}:${dateStr}:${timeWindow}:${nonce}`;
  const signature = crypto
    .createHmac('sha256', QR_SECRET)
    .update(payload)
    .digest('hex')
    .substring(0, 16);

  const tokenObj = {
    s: sessionId,
    d: dateStr,
    w: timeWindow,
    n: nonce,
    sig: signature,
  };

  const token = Buffer.from(JSON.stringify(tokenObj)).toString('base64url');
  const expiresAt = (timeWindow + 1) * rotationSeconds * 1000;
  const secondsRemaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));

  return {
    token,
    expiresAt,
    timeWindow,
    secondsRemaining,
  };
}

/**
 * Validate submitted QR token
 */
export function validateRotatingQRToken(
  tokenStr: string,
  expectedDateStr: string,
  rotationSeconds: number = 30
): { isValid: boolean; reason?: string } {
  if (!tokenStr || typeof tokenStr !== 'string') {
    return { isValid: false, reason: 'Invalid token format' };
  }

  try {
    const raw = Buffer.from(tokenStr, 'base64url').toString('utf-8');
    const tokenObj = JSON.parse(raw);

    if (!tokenObj.s || !tokenObj.d || tokenObj.w === undefined || !tokenObj.n || !tokenObj.sig) {
      return { isValid: false, reason: 'Malformed QR token structure' };
    }

    // Verify signature
    const payload = `${tokenObj.s}:${tokenObj.d}:${tokenObj.w}:${tokenObj.n}`;
    const expectedSignature = crypto
      .createHmac('sha256', QR_SECRET)
      .update(payload)
      .digest('hex')
      .substring(0, 16);

    if (tokenObj.sig !== expectedSignature) {
      return { isValid: false, reason: 'QR signature mismatch' };
    }

    // Verify date
    if (tokenObj.d !== expectedDateStr) {
      return { isValid: false, reason: 'QR code does not belong to today\'s session' };
    }

    // Verify time window (allow current window or previous 1 window for network latency grace period)
    const now = Date.now();
    const currentWindow = Math.floor(now / (rotationSeconds * 1000));
    const windowDiff = currentWindow - tokenObj.w;

    if (windowDiff < 0 || windowDiff > 2) { // up to ~60s grace
      return { isValid: false, reason: 'QR code is expired' };
    }

    return { isValid: true };
  } catch (err) {
    return { isValid: false, reason: 'Failed to decode QR token' };
  }
}
