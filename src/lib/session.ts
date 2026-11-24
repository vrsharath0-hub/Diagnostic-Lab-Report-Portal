import crypto from 'crypto';

// Session signing key uses server env secret when provided, or a process-local random 256-bit key.
const SESSION_SIGNING_KEY =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16
    ? process.env.SESSION_SECRET
    : crypto.randomBytes(32).toString('hex');

export interface PatientSessionPayload {
  type: 'patient_otp_session';
  patientId: number;
  patientCode: string;
  testCode: string;
  exp: number;
}

export function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function hashOtpCode(otp: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(otp, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyOtpCode(otp: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  const actualBuf = crypto.scryptSync(otp, salt, 32);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function generateSixDigitOtp(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function signPatientSessionToken(
  patientId: number,
  patientCode: string,
  testCode: string,
  ttlSeconds = 7200
): string {
  const payload: PatientSessionPayload = {
    type: 'patient_otp_session',
    patientId,
    patientCode,
    testCode,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(encodedPayload)
    .digest('base64url');
  return `pts.${encodedPayload}.${signature}`;
}

export function verifyPatientSessionToken(token: string): PatientSessionPayload | null {
  if (!token.startsWith('pts.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encodedPayload, providedSig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(encodedPayload)
    .digest('base64url');

  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8')
    ) as PatientSessionPayload;
    if (
      parsed.type !== 'patient_otp_session' ||
      typeof parsed.patientId !== 'number' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function isPdfBuffer(buffer: Buffer): boolean {
  if (buffer.length < 5) return false;
  return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
}
