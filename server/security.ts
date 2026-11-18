import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import type { SecurityAuditEntry } from '../src/types.ts';

const RAW_SECRET = process.env.SESSION_SECRET || 'ek-tech-solutions-academy-signing-secret-2026';

// Derive a dedicated 256-bit key for AES-256-GCM field encryption (Confidentiality)
const ENCRYPTION_KEY = crypto
  .createHmac('sha256', RAW_SECRET)
  .update('ek-tech-aes256-gcm-field-key-v1')
  .digest();

const OTP_HMAC_KEY = crypto
  .createHmac('sha256', RAW_SECRET)
  .update('ek-tech-otp-hmac-key-v1')
  .digest();

// ============================================================================
// CONFIDENTIALITY PRIMITIVES
// ============================================================================

export function encryptField(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptField(payload: string): string | null {
  try {
    const parts = payload.split('.');
    if (parts.length !== 3) return null;
    const [ivB64, tagB64, dataB64] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      ENCRYPTION_KEY,
      Buffer.from(ivB64, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

export function generateSecureOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(code: string, salt: string): string {
  return crypto.createHmac('sha256', OTP_HMAC_KEY).update(`${salt}:${code}`).digest('hex');
}

export function verifyOtpHash(code: string, salt: string, expectedHash: string): boolean {
  const candidate = hashOtp(code.trim(), salt);
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

// ============================================================================
// HTTP SECURITY HEADERS & ORIGIN / CSRF PROTECTION
// ============================================================================

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.paystack.com")');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  // Preserve Google OAuth popup compatibility while protecting origin isolation
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com https://www.gstatic.com https://js.paystack.co",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://paystack.com https://checkout.paystack.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "frame-src 'self' https://drive.google.com https://accounts.google.com https://*.firebaseapp.com https://checkout.paystack.com https://standard.paystack.co",
      "connect-src 'self' https://*.supabase.co https://www.googleapis.com https://accounts.google.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.googleapis.com https://api.paystack.co https://checkout.paystack.com",
      "frame-ancestors 'self' https://aistudio.google.com https://*.google.com",
    ].join('; ')
  );

  if (req.path.startsWith('/api/auth') || req.path.startsWith('/api/admin')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
  }
  next();
}

export function csrfOriginMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/api/')) return next();
  if (req.path === '/api/payments/paystack/webhook') return next();
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();

  // Bearer token requests are immune to ambient browser cookie CSRF
  if (req.headers.authorization?.startsWith('Bearer ')) return next();

  const cookieHeader = req.headers.cookie || '';
  if (!cookieHeader.includes('ek_session=')) return next();

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const rawFwdHost = req.headers['x-forwarded-host'];
  const host = (typeof rawFwdHost === 'string' ? rawFwdHost.split(',')[0].trim() : '') || req.headers.host || '';

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      if (host && originHost !== host) {
        return res.status(403).json({ error: 'Cross-site request rejected by CSRF origin policy.' });
      }
    } catch {
      return res.status(403).json({ error: 'Invalid request origin header.' });
    }
  } else if (referer) {
    try {
      const refHost = new URL(referer).host;
      if (host && refHost !== host) {
        return res.status(403).json({ error: 'Cross-site referer rejected by CSRF policy.' });
      }
    } catch {
      return res.status(403).json({ error: 'Invalid request referer header.' });
    }
  }

  next();
}

// ============================================================================
// INTEGRITY PRIMITIVES (INPUT VALIDATION, PASSWORD POLICY, AUDIT HASH CHAIN)
// ============================================================================

export function sanitizeText(value: unknown, maxLength = 2000): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\u0000/g, '')
    .replace(/<\s*\/?\s*script[^>]*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/\bon\w+\s*=/gi, '')
    .trim()
    .slice(0, maxLength);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must include at least one uppercase letter (A-Z).' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, error: 'Password must include at least one lowercase letter (a-z).' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must include at least one number (0-9).' };
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    return { valid: false, error: 'Password must include at least one special character (e.g. !@#$%).' };
  }
  return { valid: true };
}

export function computeAuditEntryHash(
  previousHash: string,
  entry: Omit<SecurityAuditEntry, 'entryHash'>
): string {
  const payload = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    event: entry.event,
    severity: entry.severity,
    actorEmail: entry.actorEmail,
    actorRole: entry.actorRole,
    ipAddress: entry.ipAddress,
    details: entry.details,
    previousHash,
  });
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export function verifyAuditChain(logs: SecurityAuditEntry[]): {
  valid: boolean;
  brokenIndex: number | null;
} {
  // Logs are stored newest-first (unshift), so chronological order is reversed
  const chronological = [...logs].reverse();
  let expectedPrev = 'GENESIS';

  for (let i = 0; i < chronological.length; i += 1) {
    const entry = chronological[i];
    if (entry.previousHash !== expectedPrev) {
      return { valid: false, brokenIndex: i };
    }
    const { entryHash, ...rest } = entry;
    const recomputed = computeAuditEntryHash(entry.previousHash, rest);
    if (recomputed !== entryHash) {
      return { valid: false, brokenIndex: i };
    }
    expectedPrev = entry.entryHash;
  }

  return { valid: true, brokenIndex: null };
}

export function computeDatabaseChecksum(snapshot: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

// ============================================================================
// AVAILABILITY PRIMITIVES (SLIDING-WINDOW RATE LIMITING & IP EXTRACTION)
// ============================================================================

interface RateBucket {
  timestamps: number[];
}

const rateBuckets = new Map<string, RateBucket>();

export function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  if (Array.isArray(fwd) && fwd[0]) {
    return fwd[0].trim();
  }
  return req.socket?.remoteAddress || '127.0.0.1';
}

export function createRateLimiter(bucketName: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${bucketName}:${getClientIp(req)}`;
    let bucket = rateBuckets.get(key);
    if (!bucket) {
      bucket = { timestamps: [] };
      rateBuckets.set(key, bucket);
    }
    bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, maxRequests - bucket.timestamps.length)));

    if (bucket.timestamps.length >= maxRequests) {
      const oldest = bucket.timestamps[0] || now;
      const retrySec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
      res.setHeader('Retry-After', String(retrySec));
      return res.status(429).json({
        error: `Too many requests. Please wait ${retrySec} seconds before trying again.`,
      });
    }

    bucket.timestamps.push(now);
    next();
  };
}

export function getRateLimitStats(): { activeBuckets: number } {
  const now = Date.now();
  let active = 0;
  for (const [k, b] of rateBuckets.entries()) {
    const recent = b.timestamps.filter((t) => now - t < 15 * 60 * 1000);
    if (recent.length === 0) {
      rateBuckets.delete(k);
    } else {
      active += 1;
    }
  }
  return { activeBuckets: active };
}
