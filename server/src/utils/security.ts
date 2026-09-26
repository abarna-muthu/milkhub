import crypto from 'crypto';

// Secret key for signing tokens. In production, load from JWT_SECRET env var.
const JWT_SECRET = process.env.JWT_SECRET || 'milkhub_tidb_crm_production_secret_key_2026';

/**
 * Hash a password using scrypt with a unique cryptographically random salt.
 * Returns format: salt:hash
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verify a plain text password against a stored salt:hash string.
 * Supports legacy or seeded plain passwords gracefully during migration if needed.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !password) return false;

  // Modern salt:hash format
  if (storedHash.includes(':')) {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, key] = parts;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  }

  // Fallback for initial unhashed seed if present
  return password === storedHash;
}

/**
 * Validate email address format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  // Also accept standard admin handles like admin@milkhub
  const simpleRe = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+$/;
  return re.test(email.trim()) || simpleRe.test(email.trim());
}

/**
 * Generate a cryptographically signed HMAC-SHA256 token (JWT format)
 * Header.Payload.Signature
 */
export interface TokenPayload {
  id: string;
  email: string;
  name?: string;
  role?: string;
  collection_center_id?: string;
  iat?: number;
  exp?: number;
}

export function generateAuthToken(payload: TokenPayload, expiresInDays: number = 7): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    ...payload,
    iat: now,
    exp: now + expiresInDays * 24 * 60 * 60,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Verify and decode an HMAC-SHA256 token
 */
export function verifyAuthToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadJson);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}
