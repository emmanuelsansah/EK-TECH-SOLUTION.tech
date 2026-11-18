import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { getDb } from './store.ts';
import type { UserRole } from '../src/types.ts';

const SECRET = process.env.SESSION_SECRET || 'ek-tech-solutions-academy-signing-secret-2026';
const PEPPER = process.env.PASSWORD_PEPPER || 'ek-tech-solutions-secure-pepper-key-2026';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password + PEPPER, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, key] = parts;
  const derived = crypto.scryptSync(password + PEPPER, salt, 64);
  const expected = Buffer.from(key, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export interface SessionPayload {
  userId: string;
  role: UserRole;
  tokenVersion: number;
  exp: number;
}

export function signSessionToken(userId: string, role: UserRole, tokenVersion = 1): string {
  const payload: SessionPayload = {
    userId,
    role,
    tokenVersion,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.userId || !parsed.role || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith('ek_session=')) {
        return decodeURIComponent(cookie.slice('ek_session='.length));
      }
    }
  }
  return null;
}

export interface AuthenticatedRequest extends Request {
  auth?: SessionPayload;
}

function validateSessionAgainstUser(session: SessionPayload): boolean {
  const db = getDb();
  const user = db.users.find((u) => u.id === session.userId);
  if (!user || user.status === 'SUSPENDED') return false;
  const currentVersion = user.tokenVersion || 1;
  return (session.tokenVersion || 1) === currentVersion;
}

export function attachOptionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  const session = verifySessionToken(token);
  if (session && validateSessionAgainstUser(session)) {
    req.auth = session;
  }
  next();
}

export function requireAuth(roles?: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = extractToken(req);
    const session = verifySessionToken(token);
    if (!session || !validateSessionAgainstUser(session)) {
      return res.status(401).json({ error: 'Authentication required or session revoked. Please sign in.' });
    }
    if (roles && !roles.includes(session.role)) {
      return res.status(403).json({ error: 'Access denied. You do not have permission for this action.' });
    }
    req.auth = session;
    next();
  };
}
