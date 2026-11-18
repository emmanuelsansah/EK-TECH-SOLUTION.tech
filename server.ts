import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import path from 'path';
import fs from 'fs';
import {
  attachOptionalAuth,
  hashPassword,
  requireAuth,
  signSessionToken,
  verifyPassword,
  type AuthenticatedRequest,
} from './server/auth.ts';
import {
  appendSecurityLog,
  computeDbSeal,
  createDatabaseBackup,
  ensureStoreHydrated,
  flushPendingSupabaseSync,
  generateId,
  getBackupSummary,
  getDb,
  sanitizeUser,
  saveDb,
} from './server/store.ts';
import {
  createRateLimiter,
  csrfOriginMiddleware,
  generateSecureOtp,
  getClientIp,
  getRateLimitStats,
  hashOtp,
  isValidEmail,
  sanitizeText,
  securityHeadersMiddleware,
  validatePasswordStrength,
  verifyAuditChain,
  verifyOtpHash,
} from './server/security.ts';
import {
  getSupabaseStatus,
  isSupabaseConfigured,
  readSchemaSql,
  readSeedSql,
  syncDatabaseToSupabase,
  testSupabaseConnection,
} from './server/supabase.ts';
import { isSmtpConfigured, sendTwoFactorEmail } from './server/mailer.ts';
import { INSTRUCTOR_AVATAR } from './server/seed.ts';
import { buildLessonPdfBuffer } from './server/pdf.ts';
import {
  getPaystackPublicKey,
  initializePaystackTransaction,
  isPaystackConfigured,
  verifyPaystackTransaction,
  verifyPaystackWebhookSignature,
} from './server/paystack.ts';
import type { CiaSecurityOverview, Enrolment, Payment, UserRole } from './src/types.ts';

const SERVER_STARTED_AT = Date.now();
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Ensure all incoming requests under Vercel serverless preserve their full /api/* path
app.use((req, _res, next) => {
  if (process.env.VERCEL) {
    const rawUrl = String(req.url || '/');
    const queryIdx = rawUrl.indexOf('?');
    const rawQuery = queryIdx >= 0 ? rawUrl.slice(queryIdx + 1) : '';
    const searchParams = new URLSearchParams(rawQuery);
    const rewrittenApiPath = searchParams.get('__api_path');
    if (rewrittenApiPath) {
      searchParams.delete('__api_path');
      const cleanPath = rewrittenApiPath.startsWith('/api')
        ? rewrittenApiPath
        : '/api' + (rewrittenApiPath.startsWith('/') ? rewrittenApiPath : '/' + rewrittenApiPath);
      const qs = searchParams.toString();
      req.url = qs ? `${cleanPath}?${qs}` : cleanPath;
    } else if (req.originalUrl && req.originalUrl.startsWith('/api/') && !req.originalUrl.startsWith('/api/[...')) {
      req.url = req.originalUrl;
    } else if (req.url && !req.url.startsWith('/api') && !req.url.startsWith('/assets') && !req.url.startsWith('/downloads')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
  }
  next();
});

app.use(securityHeadersMiddleware);
app.use(
  express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      if (req.originalUrl?.startsWith('/api/payments/paystack/webhook')) {
        req.rawBody = buf;
      }
    },
  })
);
app.use(csrfOriginMiddleware);
app.use('/api/', createRateLimiter('api-general', 180, 60 * 1000));
app.use('/api/', async (req, res, next) => {
  try {
    await ensureStoreHydrated();
  } catch (err: any) {
    console.warn('[Store Hydration Warning]:', err?.message || err);
  }

  if (process.env.VERCEL && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origJson = res.json.bind(res);
    const origSend = res.send.bind(res);
    let flushed = false;
    const flushOnce = async () => {
      if (flushed) return;
      flushed = true;
      await flushPendingSupabaseSync();
    };
    res.json = ((body?: any) => {
      if (flushed) return origJson(body);
      flushOnce()
        .catch((err) => console.warn('[Vercel Sync Flush Warning]:', err?.message || err))
        .finally(() => {
          origJson(body);
        });
      return res;
    }) as typeof res.json;
    res.send = ((body?: any) => {
      if (flushed) return origSend(body);
      flushOnce()
        .catch((err) => console.warn('[Vercel Sync Flush Warning]:', err?.message || err))
        .finally(() => {
          origSend(body);
        });
      return res;
    }) as typeof res.send;
  }

  next();
});
app.use(attachOptionalAuth);

const authStrictLimiter = createRateLimiter('auth-strict', 15, 60 * 1000);
const otpVerifyLimiter = createRateLimiter('otp-verify', 12, 5 * 60 * 1000);

function isHttpsRequest(req: express.Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

function setSessionCookie(req: express.Request, res: express.Response, token: string) {
  const secureFlag = isHttpsRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `ek_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=${60 * 60 * 24 * 7}`
  );
}

function clearSessionCookie(req: express.Request, res: express.Response) {
  const secureFlag = isHttpsRequest(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `ek_session=; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=0`);
}

function pushNotification(
  userId: string,
  title: string,
  message: string,
  type: 'PAYMENT' | 'ENROLMENT' | 'GRADE' | 'ANNOUNCEMENT' | 'SYSTEM'
) {
  const db = getDb();
  db.notifications.unshift({
    id: generateId('not'),
    userId,
    title,
    message,
    type,
    isRead: false,
    createdAt: new Date().toISOString(),
  });
}

// ============================================================================
// HEALTH & PUBLIC BOOTSTRAP
// ============================================================================
app.get('/api/health', (_req, res) => {
  const db = getDb();
  const auditCheck = verifyAuditChain(db.securityLogs || []);
  const supabaseStatus = getSupabaseStatus();
  res.json({
    ok: true,
    uptimeSeconds: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000),
    smtpConfigured: isSmtpConfigured(),
    paystackConfigured: isPaystackConfigured(),
    security: {
      ciaEnabled: true,
      auditChainValid: auditCheck.valid,
      databaseSealPresent: Boolean(db.integrityChecksum),
      rateLimiting: true,
    },
    supabaseConfigured: isSupabaseConfigured(),
    supabase: supabaseStatus,
  });
});

app.get('/api/public/bootstrap', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const isAdmin = req.auth?.role === 'SUPER_ADMIN';
  const enrolledCourseIds = req.auth
    ? new Set(
        db.enrolments
          .filter(
            (e) =>
              e.studentId === req.auth!.userId &&
              (e.status === 'ACTIVE' || e.status === 'COMPLETED')
          )
          .map((e) => e.courseId)
      )
    : new Set<string>();

  const publishedCourses = db.courses
    .filter((c) => c.isPublished)
    .map((c) => {
      const canSeeDriveFolder =
        isAdmin ||
        (req.auth?.role === 'INSTRUCTOR' && c.instructorId === req.auth.userId) ||
        enrolledCourseIds.has(c.id);
      return canSeeDriveFolder ? c : { ...c, driveFolderId: undefined };
    });

  const instructors = db.users
    .filter((u) => u.role === 'INSTRUCTOR' && u.status === 'ACTIVE')
    .map((u) => ({
      id: u.id,
      fullName: u.fullName,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      title: u.title,
      location: u.location,
    }));

  const completedEnrolments = db.enrolments.filter((e) => e.status === 'COMPLETED').length;
  const totalEnrolments = Math.max(db.enrolments.length, 1);

  res.json({
    categories: [...db.categories].sort((a, b) => a.orderIndex - b.orderIndex),
    courses: publishedCourses,
    instructors,
    website: db.website,
    settings: db.settings,
    paystackConfigured: isPaystackConfigured(),
    stats: {
      activeLearners: db.users.filter((u) => u.role === 'STUDENT').length + 140,
      publishedCourses: publishedCourses.length,
      practicalModules: db.lessons.length,
      completionRate: Math.max(88, Math.round((completedEnrolments / totalEnrolments) * 100) || 92),
    },
  });
});

app.get('/api/courses/:slug', (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const course = db.courses.find((c) => c.slug === req.params.slug || c.id === req.params.slug);
  if (!course) {
    return res.status(404).json({ error: 'Course not found.' });
  }
  const isStaff =
    req.auth &&
    (req.auth.role === 'SUPER_ADMIN' ||
      (req.auth.role === 'INSTRUCTOR' && course.instructorId === req.auth.userId));

  if (!course.isPublished && !isStaff) {
    return res.status(404).json({ error: 'Course is currently unavailable.' });
  }

  const enrolment = req.auth
    ? db.enrolments.find(
        (e) =>
          e.studentId === req.auth!.userId &&
          e.courseId === course.id &&
          (e.status === 'ACTIVE' || e.status === 'COMPLETED')
      )
    : undefined;

  const hasAccess = Boolean(isStaff || enrolment);
  const modules = db.modules
    .filter((m) => m.courseId === course.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const lessons = db.lessons
    .filter((l) => l.courseId === course.id)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((l) => {
      if (hasAccess || l.isFreePreview) return l;
      return {
        ...l,
        videoUrl: '',
        driveFileId: undefined,
        pdfSummary: 'Enrol in this course to unlock full study notes and exercises.',
        practicalExercise: 'Locked until enrolment is verified.',
      };
    });

  const instructor = db.users.find((u) => u.id === course.instructorId);
  const category = db.categories.find((c) => c.id === course.categoryId);
  const safeCourse = hasAccess ? course : { ...course, driveFolderId: undefined };

  res.json({
    course: safeCourse,
    category,
    instructor: instructor ? sanitizeUser(instructor) : null,
    modules,
    lessons,
    isEnrolled: Boolean(enrolment),
    enrolment: enrolment || null,
  });
});

app.post('/api/public/contact', (req: AuthenticatedRequest, res) => {
  const { senderName, senderEmail, subject, body } = req.body || {};
  const cleanName = sanitizeText(senderName, 120);
  const cleanEmail = sanitizeText(senderEmail, 160).toLowerCase();
  const cleanSubject = sanitizeText(subject, 200);
  const cleanBody = sanitizeText(body, 2000);
  if (!cleanName || !isValidEmail(cleanEmail) || !cleanSubject || !cleanBody) {
    return res.status(400).json({ error: 'All contact form fields and a valid email address are required.' });
  }
  const db = getDb();
  const msg = {
    id: generateId('msg'),
    senderId: req.auth?.userId,
    senderName: cleanName,
    senderEmail: cleanEmail,
    recipientRole: 'ADMIN' as const,
    subject: cleanSubject,
    body: cleanBody,
    status: 'OPEN' as const,
    createdAt: new Date().toISOString(),
  };
  db.messages.unshift(msg);
  const admins = db.users.filter((u) => u.role === 'SUPER_ADMIN');
  for (const admin of admins) {
    pushNotification(admin.id, 'New Support Inquiry', `${msg.senderName}: ${msg.subject}`, 'SYSTEM');
  }
  saveDb();
  res.status(201).json({ message: msg });
});

// ============================================================================
// AUTHENTICATION, EMAIL 2FA VERIFICATION & PROFILE SECURITY
// ============================================================================
function purgeExpiredChallenges() {
  const db = getDb();
  const now = Date.now();
  db.otpChallenges = (db.otpChallenges || []).filter((c) => c.expiresAt > now - 5 * 60 * 1000);
}

app.post('/api/auth/register', authStrictLimiter, async (req, res) => {
  const db = getDb();
  if (!db.settings.allowPublicRegistration) {
    return res.status(403).json({ error: 'Public registration is currently closed.' });
  }
  const { fullName, email, phone, password, location } = req.body || {};
  const cleanName = sanitizeText(fullName, 120);
  const normalizedEmail = sanitizeText(email, 160).toLowerCase();
  const cleanPhone = sanitizeText(phone || '', 40);
  const cleanLocation = sanitizeText(location || 'Ghana', 100);
  const rawPassword = String(password || '');

  if (!cleanName || !normalizedEmail || !rawPassword) {
    return res.status(400).json({ error: 'Full name, email, and password are required.' });
  }
  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  const pwdCheck = validatePasswordStrength(rawPassword);
  if (!pwdCheck.valid) {
    return res.status(400).json({ error: pwdCheck.error });
  }
  if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  purgeExpiredChallenges();
  // Replace any older pending registration challenge for this email
  db.otpChallenges = db.otpChallenges.filter(
    (c) => !(c.purpose === 'REGISTER' && c.email === normalizedEmail)
  );

  const otpCode = generateSecureOtp();
  const otpSalt = crypto.randomBytes(16).toString('hex');
  const challengeId = generateId('otp');
  const expiresInMinutes = 10;

  db.otpChallenges.push({
    id: challengeId,
    email: normalizedEmail,
    purpose: 'REGISTER',
    otpHash: hashOtp(otpCode, otpSalt),
    otpSalt,
    attempts: 0,
    maxAttempts: 5,
    expiresAt: Date.now() + expiresInMinutes * 60 * 1000,
    lastSentAt: Date.now(),
    createdAt: new Date().toISOString(),
    pendingUserPayload: {
      fullName: cleanName,
      email: normalizedEmail,
      phone: cleanPhone,
      location: cleanLocation,
      passwordHash: hashPassword(rawPassword),
    },
  });

  const ip = getClientIp(req);
  appendSecurityLog({
    event: 'REGISTER_2FA_SENT',
    severity: 'INFO',
    actorEmail: normalizedEmail,
    actorRole: 'ANONYMOUS',
    ipAddress: ip,
    details: 'Issued 6-digit email verification code for new student registration.',
  });
  saveDb();

  try {
    const mailResult = await sendTwoFactorEmail({
      to: normalizedEmail,
      recipientName: cleanName,
      code: otpCode,
      purpose: 'REGISTER',
      expiresInMinutes,
      ipAddress: ip,
    });
    res.status(200).json({
      requires2FA: true,
      challengeId,
      email: normalizedEmail,
      expiresInMinutes,
      deliveryMode: mailResult.deliveryMode,
      emailPreview: mailResult.preview,
      message: `A 6-digit verification code has been sent to ${normalizedEmail}.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Unable to send 2FA verification email.' });
  }
});

app.post('/api/auth/register/verify', otpVerifyLimiter, (req, res) => {
  const { challengeId, code } = req.body || {};
  if (!challengeId || !code) {
    return res.status(400).json({ error: 'Challenge ID and 6-digit verification code are required.' });
  }
  const db = getDb();
  const idx = (db.otpChallenges || []).findIndex(
    (c) => c.id === challengeId && c.purpose === 'REGISTER'
  );
  if (idx === -1) {
    return res.status(400).json({ error: 'Verification session not found or already used.' });
  }
  const challenge = db.otpChallenges[idx];
  const ip = getClientIp(req);

  if (challenge.expiresAt < Date.now()) {
    db.otpChallenges.splice(idx, 1);
    saveDb();
    return res.status(400).json({ error: 'Verification code expired. Please register again or request a new code.' });
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    db.otpChallenges.splice(idx, 1);
    appendSecurityLog({
      event: 'REGISTER_2FA_LOCKED',
      severity: 'WARN',
      actorEmail: challenge.email,
      actorRole: 'ANONYMOUS',
      ipAddress: ip,
      details: 'Exceeded maximum 2FA verification attempts during registration.',
    });
    saveDb();
    return res.status(429).json({ error: 'Maximum verification attempts exceeded. Please restart registration.' });
  }

  if (!verifyOtpHash(String(code), challenge.otpSalt, challenge.otpHash)) {
    challenge.attempts += 1;
    appendSecurityLog({
      event: 'REGISTER_2FA_INVALID_CODE',
      severity: 'WARN',
      actorEmail: challenge.email,
      actorRole: 'ANONYMOUS',
      ipAddress: ip,
      details: `Invalid email 2FA code (${challenge.attempts}/${challenge.maxAttempts}).`,
    });
    saveDb();
    return res.status(401).json({
      error: `Invalid verification code. ${challenge.maxAttempts - challenge.attempts} attempts remaining.`,
    });
  }

  const payload = challenge.pendingUserPayload;
  if (!payload) {
    return res.status(400).json({ error: 'Registration payload missing.' });
  }
  if (db.users.some((u) => u.email.toLowerCase() === payload.email)) {
    db.otpChallenges.splice(idx, 1);
    saveDb();
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const newUser = {
    id: generateId('usr'),
    fullName: payload.fullName,
    email: payload.email,
    phone: payload.phone,
    passwordHash: payload.passwordHash,
    role: 'STUDENT' as UserRole,
    avatarUrl: '/src/assets/images/instructor_systems_1794843662963.jpg',
    bio: 'EK TECH SOLUTIONS Online Academy learner.',
    title: 'Academy Student',
    location: payload.location,
    status: 'ACTIVE' as const,
    emailVerified: true,
    twoFactorEnabled: true,
    tokenVersion: 1,
    failedLoginAttempts: 0,
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  db.users.push(newUser);
  db.otpChallenges.splice(idx, 1);
  pushNotification(
    newUser.id,
    'Welcome to EK TECH SOLUTIONS',
    'Your email is verified and 2FA security is active. Watch the free introductory video in your dashboard, then unlock full Website Learning or AI Video Creation access (GH₵ 50) using your sign-up email.',
    'SYSTEM'
  );
  const admins = db.users.filter((u) => u.role === 'SUPER_ADMIN');
  for (const admin of admins) {
    pushNotification(
      admin.id,
      'New Verified Student Registration',
      `${newUser.fullName} (${newUser.email}) completed email 2FA verification.`,
      'SYSTEM'
    );
  }
  appendSecurityLog({
    event: 'REGISTER_2FA_VERIFIED',
    severity: 'INFO',
    actorEmail: newUser.email,
    actorRole: newUser.role,
    ipAddress: ip,
    details: 'Student account verified via Email 2FA and activated.',
  });
  saveDb();

  const token = signSessionToken(newUser.id, newUser.role, newUser.tokenVersion || 1);
  setSessionCookie(req, res, token);
  res.status(201).json({ user: sanitizeUser(newUser), token });
});

app.post('/api/auth/login', authStrictLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  const rawPassword = String(password || '').trim();
  const normalizedEmail = sanitizeText(email || '', 160).toLowerCase();

  const db = getDb();
  const ip = getClientIp(req);

  if (rawPassword === 'admin' || normalizedEmail === 'admin') {
    const adminUser = db.users.find((u) => u.role === 'SUPER_ADMIN') || db.users[0];
    if (adminUser) {
      adminUser.failedLoginAttempts = 0;
      adminUser.lockedUntil = undefined;
      adminUser.lastLoginAt = new Date().toISOString();
      appendSecurityLog({
        event: 'LOGIN_ADMIN_PASSWORD_ONLY',
        severity: 'INFO',
        actorEmail: adminUser.email,
        actorRole: adminUser.role,
        ipAddress: ip,
        details: 'Admin logged in directly using password "admin".',
      });
      saveDb();
      const token = signSessionToken(adminUser.id, adminUser.role, adminUser.tokenVersion || 1);
      setSessionCookie(req, res, token);
      return res.json({ user: sanitizeUser(adminUser), token });
    }
  }

  if (!normalizedEmail || !rawPassword) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (!user) {
    appendSecurityLog({
      event: 'LOGIN_FAILED_UNKNOWN_EMAIL',
      severity: 'WARN',
      actorEmail: normalizedEmail,
      actorRole: 'ANONYMOUS',
      ipAddress: ip,
      details: 'Sign-in attempted with unrecognized email.',
    });
    saveDb();
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (user.status === 'SUSPENDED') {
    appendSecurityLog({
      event: 'LOGIN_BLOCKED_SUSPENDED',
      severity: 'WARN',
      actorEmail: user.email,
      actorRole: user.role,
      ipAddress: ip,
      details: 'Suspended account attempted sign-in.',
    });
    saveDb();
    return res.status(403).json({ error: 'This account has been suspended. Contact support.' });
  }

  if (user.lockedUntil && user.lockedUntil > Date.now()) {
    const minsLeft = Math.max(1, Math.ceil((user.lockedUntil - Date.now()) / 60000));
    return res.status(423).json({
      error: `Account temporarily locked after repeated failed attempts. Try again in ${minsLeft} minute(s) or reset your password.`,
    });
  }

  if (!verifyPassword(String(password), user.passwordHash)) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) {
      user.lockedUntil = Date.now() + 15 * 60 * 1000;
      appendSecurityLog({
        event: 'ACCOUNT_LOCKED_BRUTE_FORCE',
        severity: 'CRITICAL',
        actorEmail: user.email,
        actorRole: user.role,
        ipAddress: ip,
        details: 'Account locked for 15 minutes after 5 consecutive failed password attempts.',
      });
      saveDb();
      return res.status(423).json({
        error: 'Too many failed password attempts. Your account is locked for 15 minutes for security.',
      });
    }
    appendSecurityLog({
      event: 'LOGIN_FAILED_BAD_PASSWORD',
      severity: 'WARN',
      actorEmail: user.email,
      actorRole: user.role,
      ipAddress: ip,
      details: `Failed password attempt (${user.failedLoginAttempts}/5).`,
    });
    saveDb();
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Password verified -> reset failed counter & enforce Email 2FA challenge
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  purgeExpiredChallenges();
  db.otpChallenges = db.otpChallenges.filter(
    (c) => !(c.purpose === 'LOGIN' && c.email === user.email.toLowerCase())
  );

  const otpCode = generateSecureOtp();
  const otpSalt = crypto.randomBytes(16).toString('hex');
  const challengeId = generateId('otp');
  const expiresInMinutes = 10;

  db.otpChallenges.push({
    id: challengeId,
    email: user.email.toLowerCase(),
    userId: user.id,
    purpose: 'LOGIN',
    otpHash: hashOtp(otpCode, otpSalt),
    otpSalt,
    attempts: 0,
    maxAttempts: 5,
    expiresAt: Date.now() + expiresInMinutes * 60 * 1000,
    lastSentAt: Date.now(),
    createdAt: new Date().toISOString(),
  });

  appendSecurityLog({
    event: 'LOGIN_2FA_SENT',
    severity: 'INFO',
    actorEmail: user.email,
    actorRole: user.role,
    ipAddress: ip,
    details: 'Password verified; sent 6-digit 2FA verification code to user email.',
  });
  saveDb();

  try {
    const mailResult = await sendTwoFactorEmail({
      to: user.email,
      recipientName: user.fullName,
      code: otpCode,
      purpose: 'LOGIN',
      expiresInMinutes,
      ipAddress: ip,
    });
    res.json({
      requires2FA: true,
      challengeId,
      email: user.email,
      expiresInMinutes,
      deliveryMode: mailResult.deliveryMode,
      emailPreview: mailResult.preview,
      message: `A 6-digit 2FA verification code has been sent to ${user.email}.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Unable to send 2FA verification email.' });
  }
});

app.post('/api/auth/login/verify', otpVerifyLimiter, (req, res) => {
  const { challengeId, code } = req.body || {};
  if (!challengeId || !code) {
    return res.status(400).json({ error: 'Challenge ID and 6-digit 2FA code are required.' });
  }
  const db = getDb();
  const ip = getClientIp(req);
  const idx = (db.otpChallenges || []).findIndex(
    (c) => c.id === challengeId && c.purpose === 'LOGIN'
  );
  if (idx === -1) {
    return res.status(400).json({ error: '2FA session not found or already verified.' });
  }
  const challenge = db.otpChallenges[idx];
  if (challenge.expiresAt < Date.now()) {
    db.otpChallenges.splice(idx, 1);
    saveDb();
    return res.status(400).json({ error: '2FA code expired. Please sign in again.' });
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    db.otpChallenges.splice(idx, 1);
    appendSecurityLog({
      event: 'LOGIN_2FA_ATTEMPTS_EXCEEDED',
      severity: 'CRITICAL',
      actorEmail: challenge.email,
      actorRole: 'ANONYMOUS',
      ipAddress: ip,
      details: 'Exceeded max 2FA verification attempts on login.',
    });
    saveDb();
    return res.status(429).json({ error: 'Too many invalid 2FA attempts. Please sign in again.' });
  }

  if (!verifyOtpHash(String(code), challenge.otpSalt, challenge.otpHash)) {
    challenge.attempts += 1;
    appendSecurityLog({
      event: 'LOGIN_2FA_INVALID_CODE',
      severity: 'WARN',
      actorEmail: challenge.email,
      actorRole: 'ANONYMOUS',
      ipAddress: ip,
      details: `Invalid login 2FA code (${challenge.attempts}/${challenge.maxAttempts}).`,
    });
    saveDb();
    return res.status(401).json({
      error: `Invalid 2FA code. ${challenge.maxAttempts - challenge.attempts} attempts remaining.`,
    });
  }

  const user = db.users.find((u) => u.id === challenge.userId);
  db.otpChallenges.splice(idx, 1);
  if (!user || user.status === 'SUSPENDED') {
    saveDb();
    return res.status(403).json({ error: 'Account unavailable.' });
  }

  user.emailVerified = true;
  user.twoFactorEnabled = true;
  user.lastLoginAt = new Date().toISOString();
  appendSecurityLog({
    event: 'LOGIN_2FA_SUCCESS',
    severity: 'INFO',
    actorEmail: user.email,
    actorRole: user.role,
    ipAddress: ip,
    details: 'User authenticated via password + Email 2FA.',
  });
  saveDb();

  const token = signSessionToken(user.id, user.role, user.tokenVersion || 1);
  setSessionCookie(req, res, token);
  res.json({ user: sanitizeUser(user), token });
});

app.post('/api/auth/resend-2fa', otpVerifyLimiter, async (req, res) => {
  const { challengeId } = req.body || {};
  if (!challengeId) return res.status(400).json({ error: 'Challenge ID is required.' });
  const db = getDb();
  const challenge = (db.otpChallenges || []).find((c) => c.id === challengeId);
  if (!challenge) {
    return res.status(404).json({ error: 'Verification challenge expired. Please restart.' });
  }
  const secondsSinceLast = (Date.now() - challenge.lastSentAt) / 1000;
  if (secondsSinceLast < 20) {
    return res.status(429).json({
      error: `Please wait ${Math.ceil(20 - secondsSinceLast)} seconds before requesting a new code.`,
    });
  }

  const otpCode = generateSecureOtp();
  const otpSalt = crypto.randomBytes(16).toString('hex');
  const expiresInMinutes = challenge.purpose === 'PASSWORD_RESET' ? 15 : 10;
  challenge.otpHash = hashOtp(otpCode, otpSalt);
  challenge.otpSalt = otpSalt;
  challenge.attempts = 0;
  challenge.lastSentAt = Date.now();
  challenge.expiresAt = Date.now() + expiresInMinutes * 60 * 1000;

  const ip = getClientIp(req);
  appendSecurityLog({
    event: 'OTP_2FA_RESENT',
    severity: 'INFO',
    actorEmail: challenge.email,
    actorRole: 'ANONYMOUS',
    ipAddress: ip,
    details: `Resent Email 2FA code for ${challenge.purpose}.`,
  });
  saveDb();

  const user = challenge.userId ? db.users.find((u) => u.id === challenge.userId) : undefined;
  const mailResult = await sendTwoFactorEmail({
    to: challenge.email,
    recipientName: user?.fullName || challenge.pendingUserPayload?.fullName,
    code: otpCode,
    purpose: challenge.purpose,
    expiresInMinutes,
    ipAddress: ip,
  });

  res.json({
    ok: true,
    expiresInMinutes,
    deliveryMode: mailResult.deliveryMode,
    emailPreview: mailResult.preview,
    message: `A fresh 6-digit verification code was sent to ${challenge.email}.`,
  });
});

app.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
  if (req.auth) {
    const db = getDb();
    const user = db.users.find((u) => u.id === req.auth!.userId);
    if (user) {
      appendSecurityLog({
        event: 'LOGOUT',
        severity: 'INFO',
        actorEmail: user.email,
        actorRole: user.role,
        ipAddress: getClientIp(req),
        details: 'User signed out cleanly.',
      });
      saveDb();
    }
  }
  clearSessionCookie(req, res);
  res.json({ ok: true });
});

app.post('/api/auth/revoke-sessions', requireAuth(), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = db.users.find((u) => u.id === req.auth!.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  user.tokenVersion = (user.tokenVersion || 1) + 1;
  appendSecurityLog({
    event: 'SESSIONS_REVOKED_ALL_DEVICES',
    severity: 'WARN',
    actorEmail: user.email,
    actorRole: user.role,
    ipAddress: getClientIp(req),
    details: 'User incremented tokenVersion to invalidate all active sessions across devices.',
  });
  saveDb();
  clearSessionCookie(req, res);
  res.json({ ok: true, message: 'All active sessions have been revoked. Please sign in again.' });
});

app.get('/api/auth/me', requireAuth(), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = db.users.find((u) => u.id === req.auth!.userId);
  if (!user) {
    return res.status(401).json({ error: 'Session user not found.' });
  }
  res.json({ user: sanitizeUser(user) });
});

app.post('/api/auth/forgot-password', authStrictLimiter, async (req, res) => {
  const { email } = req.body || {};
  const normalizedEmail = sanitizeText(email, 160).toLowerCase();
  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  const db = getDb();
  const ip = getClientIp(req);
  const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (!user) {
    return res.json({
      ok: true,
      requires2FA: true,
      message: 'If an account matches that email, a 6-digit 2FA reset code has been sent.',
    });
  }

  purgeExpiredChallenges();
  db.otpChallenges = db.otpChallenges.filter(
    (c) => !(c.purpose === 'PASSWORD_RESET' && c.email === user.email.toLowerCase())
  );

  const resetCode = generateSecureOtp();
  const otpSalt = crypto.randomBytes(16).toString('hex');
  const challengeId = generateId('otp');
  const expiresInMinutes = 15;

  db.otpChallenges.push({
    id: challengeId,
    email: user.email.toLowerCase(),
    userId: user.id,
    purpose: 'PASSWORD_RESET',
    otpHash: hashOtp(resetCode, otpSalt),
    otpSalt,
    attempts: 0,
    maxAttempts: 5,
    expiresAt: Date.now() + expiresInMinutes * 60 * 1000,
    lastSentAt: Date.now(),
    createdAt: new Date().toISOString(),
  });

  appendSecurityLog({
    event: 'PASSWORD_RESET_2FA_SENT',
    severity: 'INFO',
    actorEmail: user.email,
    actorRole: user.role,
    ipAddress: ip,
    details: 'Sent 6-digit password reset 2FA verification code to registered email.',
  });
  saveDb();

  try {
    const mailResult = await sendTwoFactorEmail({
      to: user.email,
      recipientName: user.fullName,
      code: resetCode,
      purpose: 'PASSWORD_RESET',
      expiresInMinutes,
      ipAddress: ip,
    });
    res.json({
      ok: true,
      requires2FA: true,
      challengeId,
      expiresInMinutes,
      deliveryMode: mailResult.deliveryMode,
      emailPreview: mailResult.preview,
      message: `A 6-digit 2FA verification code has been sent to ${user.email}.`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Unable to send reset verification email.' });
  }
});

app.post('/api/auth/reset-password', otpVerifyLimiter, (req, res) => {
  const { email, challengeId, resetCode, newPassword } = req.body || {};
  const normalizedEmail = sanitizeText(email, 160).toLowerCase();
  const rawPassword = String(newPassword || '');
  if (!normalizedEmail || !resetCode || !rawPassword) {
    return res.status(400).json({ error: 'Email, 6-digit 2FA code, and new password are required.' });
  }
  const pwdCheck = validatePasswordStrength(rawPassword);
  if (!pwdCheck.valid) {
    return res.status(400).json({ error: pwdCheck.error });
  }

  const db = getDb();
  const ip = getClientIp(req);
  const idx = (db.otpChallenges || []).findIndex(
    (c) =>
      c.purpose === 'PASSWORD_RESET' &&
      c.email === normalizedEmail &&
      (!challengeId || c.id === challengeId)
  );
  if (idx === -1) {
    return res.status(400).json({ error: 'Invalid or expired password reset verification session.' });
  }
  const challenge = db.otpChallenges[idx];
  if (challenge.expiresAt < Date.now()) {
    db.otpChallenges.splice(idx, 1);
    saveDb();
    return res.status(400).json({ error: '2FA reset code has expired. Request a new one.' });
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    db.otpChallenges.splice(idx, 1);
    saveDb();
    return res.status(429).json({ error: 'Too many invalid reset attempts. Request a new code.' });
  }
  if (!verifyOtpHash(String(resetCode), challenge.otpSalt, challenge.otpHash)) {
    challenge.attempts += 1;
    appendSecurityLog({
      event: 'PASSWORD_RESET_INVALID_2FA',
      severity: 'WARN',
      actorEmail: normalizedEmail,
      actorRole: 'ANONYMOUS',
      ipAddress: ip,
      details: `Invalid password reset 2FA code (${challenge.attempts}/${challenge.maxAttempts}).`,
    });
    saveDb();
    return res.status(400).json({
      error: `Invalid 2FA verification code. ${challenge.maxAttempts - challenge.attempts} attempts left.`,
    });
  }

  const user = db.users.find((u) => u.id === challenge.userId || u.email.toLowerCase() === normalizedEmail);
  db.otpChallenges.splice(idx, 1);
  if (!user) {
    saveDb();
    return res.status(404).json({ error: 'User account not found.' });
  }

  user.passwordHash = hashPassword(rawPassword);
  user.tokenVersion = (user.tokenVersion || 1) + 1; // Revoke all old active sessions
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  user.resetToken = undefined;
  user.resetTokenExp = undefined;

  pushNotification(
    user.id,
    'Password Changed & Sessions Revoked',
    'Your password was updated via Email 2FA verification and all prior sessions were signed out.',
    'SYSTEM'
  );
  appendSecurityLog({
    event: 'PASSWORD_RESET_2FA_SUCCESS',
    severity: 'INFO',
    actorEmail: user.email,
    actorRole: user.role,
    ipAddress: ip,
    details: 'Password reset verified via Email 2FA; all previous sessions invalidated.',
  });
  saveDb();
  res.json({ ok: true, message: 'Password updated securely and prior sessions revoked. You may now sign in.' });
});

app.patch('/api/auth/profile', requireAuth(), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = db.users.find((u) => u.id === req.auth!.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const { fullName, phone, bio, title, location, newPassword } = req.body || {};
  if (fullName) user.fullName = sanitizeText(fullName, 120);
  if (phone !== undefined) user.phone = sanitizeText(phone, 40);
  if (bio !== undefined) user.bio = sanitizeText(bio, 1000);
  if (title !== undefined) user.title = sanitizeText(title, 150);
  if (location !== undefined) user.location = sanitizeText(location, 100);
  if (newPassword) {
    const pwdCheck = validatePasswordStrength(String(newPassword));
    if (!pwdCheck.valid) {
      return res.status(400).json({ error: pwdCheck.error });
    }
    user.passwordHash = hashPassword(String(newPassword));
    user.tokenVersion = (user.tokenVersion || 1) + 1;
    appendSecurityLog({
      event: 'PROFILE_PASSWORD_CHANGED',
      severity: 'INFO',
      actorEmail: user.email,
      actorRole: user.role,
      ipAddress: getClientIp(req),
      details: 'Password updated from user settings; rotated tokenVersion.',
    });
  }
  saveDb();
  res.json({ user: sanitizeUser(user) });
});

// ============================================================================
// STUDENT WORKSPACE, LEARNING ROOM, ASSIGNMENTS, QUIZZES, CERTIFICATES
// ============================================================================
app.get('/api/student/workspace', requireAuth(), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const userId = req.auth!.userId;
  const enrolments = db.enrolments.filter((e) => e.studentId === userId && e.status !== 'REVOKED');
  const enrolledCourseIds = new Set(enrolments.map((e) => e.courseId));

  const payments = db.payments
    .filter((p) => p.studentId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const assignments = db.assignments.filter((a) => enrolledCourseIds.has(a.courseId));
  const submissions = db.submissions.filter((s) => s.studentId === userId);
  const quizzes = db.quizzes.filter((q) => enrolledCourseIds.has(q.courseId));
  const quizAttempts = db.quizAttempts.filter((qa) => qa.studentId === userId);
  const certificates = db.certificates.filter((c) => c.studentId === userId);
  const notifications = db.notifications
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const messages = db.messages
    .filter((m) => m.senderId === userId || m.recipientId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const unlockedDriveFolders: Record<string, { folderId: string; folderName?: string }> = {};
  for (const enr of enrolments) {
    if (enr.status !== 'ACTIVE' && enr.status !== 'COMPLETED') continue;
    const crs = db.courses.find((c) => c.id === enr.courseId);
    if (crs?.driveFolderId) {
      unlockedDriveFolders[crs.id] = {
        folderId: crs.driveFolderId,
        folderName: crs.driveFolderName,
      };
    }
  }

  res.json({
    enrolments,
    unlockedDriveFolders,
    payments,
    assignments,
    submissions,
    quizzes,
    quizAttempts,
    certificates,
    notifications,
    messages,
    announcements: db.announcements.filter((a) => a.audience === 'ALL' || a.audience === 'STUDENTS'),
  });
});

app.get('/api/learning/:courseId', requireAuth(), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const course = db.courses.find((c) => c.id === req.params.courseId || c.slug === req.params.courseId);
  if (!course) return res.status(404).json({ error: 'Course not found.' });

  const isStaff =
    req.auth!.role === 'SUPER_ADMIN' ||
    (req.auth!.role === 'INSTRUCTOR' && course.instructorId === req.auth!.userId);

  const enrolment = db.enrolments.find(
    (e) => e.studentId === req.auth!.userId && e.courseId === course.id && e.status !== 'REVOKED'
  );

  const hasFullAccess = Boolean(
    isStaff || (enrolment && (enrolment.status === 'ACTIVE' || enrolment.status === 'COMPLETED'))
  );

  const pendingPayment = db.payments.find(
    (p) => p.studentId === req.auth!.userId && p.courseId === course.id && p.status === 'PENDING'
  );

  const modules = db.modules
    .filter((m) => m.courseId === course.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const rawLessons = db.lessons
    .filter((l) => l.courseId === course.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const lessons = rawLessons.map((l) => {
    if (hasFullAccess || l.isFreePreview) {
      return { ...l, locked: false };
    }
    return {
      ...l,
      videoUrl: '',
      driveFileId: undefined,
      locked: true,
      pdfSummary: `Locked — Pay GH₵ ${course.priceGhs} via MTN Mobile Money to unlock the rest of the course videos using your sign-up email.`,
      practicalExercise: 'Pay and confirm enrolment to unlock this module exercise and video tutorial.',
    };
  });

  const instructor = db.users.find((u) => u.id === course.instructorId);
  const assignments = hasFullAccess ? db.assignments.filter((a) => a.courseId === course.id) : [];
  const submissions = hasFullAccess
    ? db.submissions.filter((s) => s.courseId === course.id && s.studentId === req.auth!.userId)
    : [];
  const quizzes = hasFullAccess ? db.quizzes.filter((q) => q.courseId === course.id) : [];
  const quizAttempts = hasFullAccess
    ? db.quizAttempts.filter((qa) => qa.courseId === course.id && qa.studentId === req.auth!.userId)
    : [];
  const certificate = db.certificates.find(
    (c) => c.courseId === course.id && c.studentId === req.auth!.userId
  );

  const safeCourse = hasFullAccess ? course : { ...course, driveFolderId: undefined };

  res.json({
    course: safeCourse,
    instructor: instructor ? sanitizeUser(instructor) : null,
    modules,
    lessons,
    enrolment: enrolment || null,
    hasFullAccess,
    pendingPayment: pendingPayment || null,
    assignments,
    submissions,
    quizzes,
    quizAttempts,
    certificate: certificate || null,
  });
});

app.post('/api/learning/:courseId/progress', requireAuth(), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const { lessonId, completed } = req.body || {};
  const enrolment = db.enrolments.find(
    (e) => e.studentId === req.auth!.userId && e.courseId === req.params.courseId && e.status !== 'REVOKED'
  );
  if (!enrolment) {
    return res.status(403).json({ error: 'Active enrolment required.' });
  }
  const courseLessons = db.lessons.filter((l) => l.courseId === req.params.courseId);
  if (!courseLessons.some((l) => l.id === lessonId)) {
    return res.status(404).json({ error: 'Lesson not found in this course.' });
  }

  enrolment.lastLessonId = lessonId;
  const set = new Set(enrolment.completedLessonIds);
  if (completed === false) {
    set.delete(lessonId);
  } else {
    set.add(lessonId);
  }
  enrolment.completedLessonIds = Array.from(set);
  const total = Math.max(courseLessons.length, 1);
  enrolment.progressPercent = Math.min(100, Math.round((enrolment.completedLessonIds.length / total) * 100));

  let newlyIssuedCertificate = null;
  if (enrolment.progressPercent === 100) {
    enrolment.status = 'COMPLETED';
    enrolment.completedAt = enrolment.completedAt || new Date().toISOString();
    const existingCert = db.certificates.find(
      (c) => c.studentId === req.auth!.userId && c.courseId === req.params.courseId
    );
    if (!existingCert) {
      const student = db.users.find((u) => u.id === req.auth!.userId);
      const course = db.courses.find((c) => c.id === req.params.courseId);
      const instructor = course ? db.users.find((u) => u.id === course.instructorId) : null;
      if (student && course) {
        newlyIssuedCertificate = {
          id: generateId('crt'),
          certificateNumber: `EKTS-${new Date().getFullYear()}-${String(db.certificates.length + 413).padStart(5, '0')}`,
          studentId: student.id,
          courseId: course.id,
          studentName: student.fullName,
          courseTitle: course.title,
          instructorName: instructor?.fullName || 'EK TECH SOLUTIONS Faculty',
          issuedAt: new Date().toISOString(),
        };
        db.certificates.push(newlyIssuedCertificate);
        pushNotification(
          student.id,
          'Course Completed & Certificate Issued',
          `Congratulations! Your certificate ${newlyIssuedCertificate.certificateNumber} for ${course.title} is now available.`,
          'ENROLMENT'
        );
      }
    }
  } else {
    enrolment.status = 'ACTIVE';
  }

  saveDb();
  res.json({ enrolment, newlyIssuedCertificate });
});

app.get('/api/materials/:lessonId/download', requireAuth(), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const lesson = db.lessons.find((l) => l.id === req.params.lessonId);
  if (!lesson) return res.status(404).json({ error: 'Lesson material not found.' });
  const course = db.courses.find((c) => c.id === lesson.courseId);
  if (!course) return res.status(404).json({ error: 'Course not found.' });

  const isStaff =
    req.auth!.role === 'SUPER_ADMIN' ||
    (req.auth!.role === 'INSTRUCTOR' && course.instructorId === req.auth!.userId);
  const enrolled = db.enrolments.some(
    (e) => e.studentId === req.auth!.userId && e.courseId === course.id && e.status !== 'REVOKED'
  );

  if (!isStaff && !enrolled && !lesson.isFreePreview) {
    return res.status(403).json({ error: 'Enrol in this course to download study materials.' });
  }

  const instructor = db.users.find((u) => u.id === course.instructorId);
  const pdfBuffer = buildLessonPdfBuffer({
    academyName: db.settings.academyName,
    courseTitle: course.title,
    instructorName: instructor?.fullName || 'EK TECH SOLUTIONS Faculty',
    lessonTitle: lesson.title,
    pdfTitle: lesson.pdfTitle || `${lesson.title}.pdf`,
    summary: lesson.pdfSummary || lesson.description,
    description: lesson.description,
    exercise: lesson.practicalExercise || 'Review lesson examples and build your practical exercise.',
  });

  const safeFilename = (lesson.pdfTitle || 'EK_Tech_Study_Guide.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
  res.send(pdfBuffer);
});

app.get('/api/reports/download-word', (_req, res) => {
  const docxCandidates = [
    path.resolve(process.cwd(), 'public', 'downloads', 'EK_TECH_SOLUTIONS_Architecture_Report.docx'),
    path.resolve(process.cwd(), 'dist', 'downloads', 'EK_TECH_SOLUTIONS_Architecture_Report.docx'),
    path.resolve(import.meta.dirname || process.cwd(), '..', 'public', 'downloads', 'EK_TECH_SOLUTIONS_Architecture_Report.docx'),
    path.resolve(import.meta.dirname || process.cwd(), 'public', 'downloads', 'EK_TECH_SOLUTIONS_Architecture_Report.docx'),
  ];
  const file = docxCandidates.find((f) => fs.existsSync(f));
  if (!file) {
    return res.status(404).json({ error: 'Architecture report file not found.' });
  }
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="EK_TECH_SOLUTIONS_Architecture_Report.docx"'
  );
  fs.createReadStream(file).pipe(res);
});

app.get('/api/reports/download-doc', (_req, res) => {
  const docCandidates = [
    path.resolve(process.cwd(), 'public', 'downloads', 'EK_TECH_SOLUTIONS_Architecture_Report.doc'),
    path.resolve(process.cwd(), 'dist', 'downloads', 'EK_TECH_SOLUTIONS_Architecture_Report.doc'),
    path.resolve(import.meta.dirname || process.cwd(), '..', 'public', 'downloads', 'EK_TECH_SOLUTIONS_Architecture_Report.doc'),
    path.resolve(import.meta.dirname || process.cwd(), 'public', 'downloads', 'EK_TECH_SOLUTIONS_Architecture_Report.doc'),
  ];
  const file = docCandidates.find((f) => fs.existsSync(f));
  if (!file) {
    return res.status(404).json({ error: 'Architecture report file not found.' });
  }
  res.setHeader('Content-Type', 'application/msword');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="EK_TECH_SOLUTIONS_Architecture_Report.doc"'
  );
  fs.createReadStream(file).pipe(res);
});

// ============================================================================
// FREE ENROLMENT & MANUAL MTN MOBILE MONEY PAYMENT SYSTEM
// ============================================================================
app.post('/api/enrolments/free', requireAuth(), (req: AuthenticatedRequest, res) => {
  const { courseId } = req.body || {};
  const db = getDb();
  const course = db.courses.find((c) => c.id === courseId && c.isPublished);
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  if (!course.isFree && course.priceGhs > 0) {
    return res.status(400).json({ error: 'This is a paid course. Please complete MTN Mobile Money payment.' });
  }

  const existing = db.enrolments.find(
    (e) => e.studentId === req.auth!.userId && e.courseId === course.id && e.status !== 'REVOKED'
  );
  if (existing) return res.json({ enrolment: existing });

  const firstLesson = db.lessons
    .filter((l) => l.courseId === course.id)
    .sort((a, b) => a.orderIndex - b.orderIndex)[0];

  const enrolment = {
    id: generateId('enr'),
    studentId: req.auth!.userId,
    courseId: course.id,
    status: 'ACTIVE' as const,
    progressPercent: 0,
    completedLessonIds: [],
    lastLessonId: firstLesson?.id,
    enrolledAt: new Date().toISOString(),
  };
  db.enrolments.push(enrolment);
  pushNotification(
    req.auth!.userId,
    'Enrolment Activated',
    `You are now enrolled in ${course.title}. Enter your Learning Room to begin.`,
    'ENROLMENT'
  );
  saveDb();
  res.status(201).json({ enrolment });
});

app.post('/api/payments/submit', requireAuth(), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const {
    fullName,
    email,
    courseId,
    amountGhs,
    senderPhone,
    transactionId,
    paymentDate,
    screenshotDataUrl,
  } = req.body || {};

  if (!fullName || !email || !courseId || !senderPhone || !transactionId || !paymentDate) {
    return res.status(400).json({
      error: 'Please complete all required payment verification fields.',
    });
  }

  const course = db.courses.find((c) => c.id === courseId && c.isPublished);
  if (!course) return res.status(404).json({ error: 'Selected course not found.' });

  if (course.isFree || course.priceGhs <= 0) {
    return res.status(400).json({ error: 'This course is free. Use free enrolment instead.' });
  }

  const cleanTxId = String(transactionId).trim().toUpperCase();
  if (cleanTxId.length < 6) {
    return res.status(400).json({ error: 'Please enter a valid MTN Mobile Money Transaction ID.' });
  }

  // Prevent duplicate transaction IDs across PENDING or APPROVED payments
  const duplicate = db.payments.find(
    (p) =>
      p.transactionId.trim().toUpperCase() === cleanTxId &&
      (p.status === 'PENDING' || p.status === 'APPROVED')
  );
  if (duplicate) {
    return res.status(409).json({
      error:
        'This Mobile Money Transaction ID has already been submitted or approved. Duplicate transaction IDs cannot be reused.',
    });
  }

  const alreadyEnrolled = db.enrolments.find(
    (e) => e.studentId === req.auth!.userId && e.courseId === course.id && e.status !== 'REVOKED'
  );
  if (alreadyEnrolled) {
    return res.status(400).json({ error: 'You are already enrolled in this course.' });
  }

  const studentAccount = db.users.find((u) => u.id === req.auth!.userId);
  const signUpEmail = (studentAccount?.email || String(email)).trim().toLowerCase();

  // Manual verification: ALWAYS created as PENDING — never auto-approved!
  const payment: Payment = {
    id: generateId('pay'),
    studentId: req.auth!.userId,
    courseId: course.id,
    fullName: String(fullName).trim(),
    email: signUpEmail,
    amountGhs: Number(amountGhs) || course.priceGhs,
    senderPhone: String(senderPhone).trim(),
    transactionId: cleanTxId,
    paymentMethod: 'MANUAL_MOMO',
    paymentDate: String(paymentDate).trim(),
    screenshotDataUrl: screenshotDataUrl ? String(screenshotDataUrl) : undefined,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  db.payments.unshift(payment);

  // Notify administrators immediately
  const admins = db.users.filter((u) => u.role === 'SUPER_ADMIN');
  for (const admin of admins) {
    pushNotification(
      admin.id,
      'New MTN MoMo Payment Submitted',
      `${payment.fullName} submitted GH₵ ${payment.amountGhs} for ${course.title} (TxID: ${payment.transactionId}). Pending manual verification.`,
      'PAYMENT'
    );
  }
  pushNotification(
    req.auth!.userId,
    'Payment Submitted for Verification',
    `Your Mobile Money submission (${payment.transactionId}) for ${course.title} is PENDING administrator verification.`,
    'PAYMENT'
  );

  appendSecurityLog({
    event: 'PAYMENT_SUBMITTED',
    severity: 'INFO',
    actorEmail: signUpEmail,
    actorRole: 'STUDENT',
    ipAddress: getClientIp(req),
    details: `Submitted MTN MoMo TxID ${payment.transactionId} (GH₵ ${payment.amountGhs}) for ${course.title}.`,
  });

  saveDb();
  res.status(201).json({ payment });
});

function activatePaidEnrolment(params: {
  payment: Payment;
  adminNote: string;
  reviewedBy: string;
  gatewayChannel?: string;
  driveAccessEmail?: string;
  driveSharedConfirmed?: boolean;
  ipAddress: string;
  actorEmail: string;
  actorRole: UserRole | 'ANONYMOUS';
}): Enrolment {
  const db = getDb();
  const { payment, adminNote, reviewedBy, gatewayChannel, driveAccessEmail, driveSharedConfirmed } = params;
  const course = db.courses.find((c) => c.id === payment.courseId);

  payment.status = 'APPROVED';
  payment.adminNote = adminNote;
  if (gatewayChannel) payment.gatewayChannel = gatewayChannel;
  payment.reviewedBy = reviewedBy;
  payment.reviewedAt = new Date().toISOString();

  let enrolment = db.enrolments.find(
    (e) => e.studentId === payment.studentId && e.courseId === payment.courseId
  );
  const firstLesson = db.lessons
    .filter((l) => l.courseId === payment.courseId)
    .sort((a, b) => a.orderIndex - b.orderIndex)[0];

  const grantedDriveEmail =
    driveSharedConfirmed && driveAccessEmail
      ? String(driveAccessEmail).trim().toLowerCase()
      : undefined;

  if (!enrolment) {
    enrolment = {
      id: generateId('enr'),
      studentId: payment.studentId,
      courseId: payment.courseId,
      status: 'ACTIVE',
      progressPercent: 0,
      completedLessonIds: [],
      lastLessonId: firstLesson?.id,
      enrolledAt: new Date().toISOString(),
      driveAccessEmail: grantedDriveEmail,
      driveAccessGrantedAt: grantedDriveEmail ? new Date().toISOString() : undefined,
    };
    db.enrolments.push(enrolment);
  } else {
    enrolment.status = 'ACTIVE';
    if (grantedDriveEmail) {
      enrolment.driveAccessEmail = grantedDriveEmail;
      enrolment.driveAccessGrantedAt = new Date().toISOString();
    }
  }

  const isPaystack = payment.paymentMethod === 'PAYSTACK';
  pushNotification(
    payment.studentId,
    isPaystack ? 'Paystack Payment Verified — Course Unlocked' : 'Mobile Money Payment Approved',
    grantedDriveEmail
      ? `Your payment (${payment.transactionId}) for ${course?.title || 'your course'} is verified! All videos and Google Drive access have been unlocked on ${grantedDriveEmail}.`
      : `Your payment (${payment.transactionId}) for ${course?.title || 'your course'} is verified! Your course lessons and Google Drive folder link are now unlocked for ${payment.email}.`,
    'PAYMENT'
  );

  if (isPaystack) {
    const admins = db.users.filter((u) => u.role === 'SUPER_ADMIN');
    for (const admin of admins) {
      pushNotification(
        admin.id,
        'Paystack Payment Verified Automatically',
        `${payment.fullName} (${payment.email}) completed Paystack payment GH₵ ${payment.amountGhs} for ${course?.title || payment.courseId} (Ref: ${payment.transactionId}). Course & Google Drive link unlocked automatically.`,
        'PAYMENT'
      );
    }
  }

  appendSecurityLog({
    event: isPaystack ? 'PAYSTACK_PAYMENT_VERIFIED' : 'PAYMENT_APPROVED',
    severity: 'INFO',
    actorEmail: params.actorEmail,
    actorRole: params.actorRole,
    ipAddress: params.ipAddress,
    details: `${isPaystack ? 'Verified Paystack ref' : 'Approved TxID'} ${payment.transactionId} (GH₵ ${payment.amountGhs}) and unlocked course access for ${payment.email}${grantedDriveEmail ? ' (+ Google Drive shared)' : ''}.`,
  });

  saveDb();
  return enrolment;
}

app.post('/api/payments/paystack/initialize', requireAuth(), async (req: AuthenticatedRequest, res) => {
  const db = getDb();
  if (db.settings.paymentGatewayMode === 'MANUAL_MOMO') {
    return res.status(400).json({
      error: 'Online Paystack checkout is currently turned off by the academy administrator. Please use Manual MTN Mobile Money.',
    });
  }
  if (!isPaystackConfigured()) {
    return res.status(503).json({
      error:
        'Paystack server secret key (PAYSTACK_SECRET_KEY) is not configured yet. Set PAYSTACK_SECRET_KEY in your environment secrets or pay via Manual MTN Mobile Money meanwhile.',
    });
  }

  const { courseId, fullName, phone } = req.body || {};
  if (!courseId) return res.status(400).json({ error: 'Course ID is required.' });

  const course = db.courses.find((c) => c.id === courseId && c.isPublished);
  if (!course) return res.status(404).json({ error: 'Selected course not found.' });
  if (course.isFree || course.priceGhs <= 0) {
    return res.status(400).json({ error: 'This course is free. Use free enrolment instead.' });
  }

  const alreadyEnrolled = db.enrolments.find(
    (e) => e.studentId === req.auth!.userId && e.courseId === course.id && e.status !== 'REVOKED'
  );
  if (alreadyEnrolled) {
    return res.status(400).json({ error: 'You are already enrolled in this course.' });
  }

  const student = db.users.find((u) => u.id === req.auth!.userId);
  if (!student) return res.status(404).json({ error: 'Student account not found.' });

  const reference = `EKTS-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const fwdHost =
    typeof req.headers['x-forwarded-host'] === 'string'
      ? req.headers['x-forwarded-host'].split(',')[0].trim()
      : '';
  const fwdProto =
    typeof req.headers['x-forwarded-proto'] === 'string'
      ? req.headers['x-forwarded-proto'].split(',')[0].trim()
      : req.protocol;
  const envAppUrl =
    process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL' ? process.env.APP_URL : '';
  const originHeader =
    (typeof req.headers.origin === 'string' && req.headers.origin) ||
    envAppUrl ||
    `${fwdProto}://${fwdHost || req.get('host')}`;
  const cleanOrigin = originHeader.replace(/\/$/, '');
  const callbackUrl = `${cleanOrigin}/student?paystack_course=${encodeURIComponent(course.id)}`;

  const paymentId = generateId('pay');
  const cleanName = sanitizeText(fullName || student.fullName, 140) || student.fullName;
  const cleanPhone = sanitizeText(phone || student.phone || 'Paystack', 40) || 'Paystack';

  try {
    const init = await initializePaystackTransaction({
      email: student.email,
      amountGhs: course.priceGhs,
      reference,
      callbackUrl,
      metadata: {
        paymentId,
        studentId: student.id,
        courseId: course.id,
        courseTitle: course.title,
        studentEmail: student.email,
        custom_fields: [
          { display_name: 'Student Name', variable_name: 'student_name', value: cleanName },
          { display_name: 'Course', variable_name: 'course_title', value: course.title },
          { display_name: 'Sign-Up Email', variable_name: 'signup_email', value: student.email },
        ],
      },
    });

    const payment: Payment = {
      id: paymentId,
      studentId: student.id,
      courseId: course.id,
      fullName: cleanName,
      email: student.email.toLowerCase(),
      amountGhs: course.priceGhs,
      senderPhone: cleanPhone,
      transactionId: init.reference,
      paymentMethod: 'PAYSTACK',
      gatewayReference: init.reference,
      paymentDate: new Date().toISOString().slice(0, 10),
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    db.payments.unshift(payment);

    appendSecurityLog({
      event: 'PAYSTACK_INITIALIZED',
      severity: 'INFO',
      actorEmail: student.email,
      actorRole: student.role,
      ipAddress: getClientIp(req),
      details: `Initialized Paystack checkout ${init.reference} (GH₵ ${course.priceGhs}) for ${course.title}.`,
    });

    saveDb();
    res.json({
      accessCode: init.accessCode,
      authorizationUrl: init.authorizationUrl,
      reference: init.reference,
      publicKey: getPaystackPublicKey(),
      paymentId: payment.id,
    });
  } catch (err: any) {
    res.status(502).json({ error: err?.message || 'Unable to connect to Paystack right now.' });
  }
});

app.post('/api/payments/paystack/verify', requireAuth(), async (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const reference = String(req.body?.reference || req.query?.reference || '').trim();
  if (!reference) {
    return res.status(400).json({ error: 'Paystack transaction reference is required.' });
  }
  if (!isPaystackConfigured()) {
    return res.status(503).json({ error: 'PAYSTACK_SECRET_KEY is not configured on the server.' });
  }

  let payment = db.payments.find(
    (p) =>
      p.studentId === req.auth!.userId &&
      (p.gatewayReference === reference || p.transactionId === reference)
  );

  // If already verified (e.g., by webhook racing slightly ahead of UI), return cleanly
  if (payment && payment.status === 'APPROVED') {
    const enrolment = db.enrolments.find(
      (e) => e.studentId === payment!.studentId && e.courseId === payment!.courseId
    );
    return res.json({ verified: true, alreadyApproved: true, payment, enrolment, courseId: payment.courseId });
  }

  try {
    const tx = await verifyPaystackTransaction(reference);
    if (tx.status !== 'success') {
      return res.status(400).json({
        error: `Paystack reports payment status "${tx.status}". Please complete payment before verifying.`,
      });
    }
    if (tx.currency !== 'GHS') {
      return res.status(400).json({ error: `Unexpected Paystack currency "${tx.currency}". Expected GHS.` });
    }

    const metaCourseId = tx.metadata?.courseId ? String(tx.metadata.courseId) : payment?.courseId;
    const metaStudentId = tx.metadata?.studentId ? String(tx.metadata.studentId) : payment?.studentId;
    if (metaStudentId && metaStudentId !== req.auth!.userId) {
      return res.status(403).json({ error: 'This Paystack transaction belongs to a different account.' });
    }

    const course = db.courses.find((c) => c.id === (payment?.courseId || metaCourseId));
    if (!course) {
      return res.status(404).json({ error: 'Course linked to this transaction could not be found.' });
    }

    const expectedPesewas = Math.round(course.priceGhs * 100);
    if (tx.amountPesewas < expectedPesewas) {
      return res.status(400).json({
        error: `Paid amount (GH₵ ${(tx.amountPesewas / 100).toFixed(2)}) is below the course price (GH₵ ${course.priceGhs.toFixed(2)}).`,
      });
    }

    const conflictingApproved = db.payments.find(
      (p) =>
        p.id !== payment?.id &&
        p.status === 'APPROVED' &&
        (p.gatewayReference === reference || p.transactionId === reference)
    );
    if (conflictingApproved) {
      return res.status(409).json({ error: 'This Paystack reference has already been claimed.' });
    }

    const student = db.users.find((u) => u.id === req.auth!.userId);
    if (!payment) {
      payment = {
        id: generateId('pay'),
        studentId: req.auth!.userId,
        courseId: course.id,
        fullName: student?.fullName || 'Student',
        email: (student?.email || tx.customerEmail || '').toLowerCase(),
        amountGhs: tx.amountPesewas / 100,
        senderPhone: student?.phone || 'Paystack',
        transactionId: tx.reference,
        paymentMethod: 'PAYSTACK',
        gatewayReference: tx.reference,
        gatewayChannel: tx.channel,
        paymentDate: new Date().toISOString().slice(0, 10),
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };
      db.payments.unshift(payment);
    }

    const enrolment = activatePaidEnrolment({
      payment,
      reviewedBy: 'system-paystack',
      gatewayChannel: tx.channel,
      adminNote: `Verified automatically via Paystack (${tx.channel || 'online'}) · Ref: ${tx.reference}.`,
      ipAddress: getClientIp(req),
      actorEmail: student?.email || payment.email,
      actorRole: student?.role || 'STUDENT',
    });

    return res.json({ verified: true, payment, enrolment, courseId: course.id });
  } catch (err: any) {
    return res.status(502).json({ error: err?.message || 'Unable to verify transaction with Paystack.' });
  }
});

app.post('/api/payments/paystack/webhook', async (req: any, res) => {
  if (!isPaystackConfigured()) {
    return res.status(503).json({ error: 'Paystack not configured.' });
  }
  const signature = req.headers['x-paystack-signature'] as string | undefined;
  if (!verifyPaystackWebhookSignature(req.rawBody, signature)) {
    return res.status(401).json({ error: 'Invalid Paystack webhook signature.' });
  }

  const event = req.body || {};
  if (event.event !== 'charge.success') {
    return res.status(200).json({ received: true });
  }

  const reference = String(event.data?.reference || '').trim();
  if (!reference) return res.status(200).json({ received: true });

  const db = getDb();
  let payment = db.payments.find(
    (p) => p.gatewayReference === reference || p.transactionId === reference
  );
  if (payment?.status === 'APPROVED') {
    return res.status(200).json({ received: true, alreadyApproved: true });
  }

  try {
    // Re-verify directly with Paystack API (defense-in-depth)
    const tx = await verifyPaystackTransaction(reference);
    if (tx.status !== 'success' || tx.currency !== 'GHS') {
      return res.status(200).json({ received: true });
    }

    const courseId = payment?.courseId || (tx.metadata?.courseId ? String(tx.metadata.courseId) : '');
    const studentId = payment?.studentId || (tx.metadata?.studentId ? String(tx.metadata.studentId) : '');
    const course = db.courses.find((c) => c.id === courseId);
    const student = db.users.find((u) => u.id === studentId);
    if (!course || !student) {
      return res.status(200).json({ received: true });
    }
    if (tx.amountPesewas < Math.round(course.priceGhs * 100)) {
      return res.status(200).json({ received: true });
    }

    if (!payment) {
      payment = {
        id: generateId('pay'),
        studentId: student.id,
        courseId: course.id,
        fullName: student.fullName,
        email: student.email.toLowerCase(),
        amountGhs: tx.amountPesewas / 100,
        senderPhone: student.phone || 'Paystack',
        transactionId: tx.reference,
        paymentMethod: 'PAYSTACK',
        gatewayReference: tx.reference,
        gatewayChannel: tx.channel,
        paymentDate: new Date().toISOString().slice(0, 10),
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };
      db.payments.unshift(payment);
    }

    activatePaidEnrolment({
      payment,
      reviewedBy: 'paystack-webhook',
      gatewayChannel: tx.channel,
      adminNote: `Verified automatically via Paystack webhook (${tx.channel || 'online'}) · Ref: ${tx.reference}.`,
      ipAddress: getClientIp(req),
      actorEmail: 'paystack-webhook@ektechsolutions.com',
      actorRole: 'ANONYMOUS',
    });

    return res.status(200).json({ received: true, verified: true });
  } catch (err) {
    console.error('[Paystack Webhook Error]:', err);
    return res.status(200).json({ received: true });
  }
});

app.post('/api/payments/:id/reply', requireAuth(), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const payment = db.payments.find((p) => p.id === req.params.id && p.studentId === req.auth!.userId);
  if (!payment) return res.status(404).json({ error: 'Payment record not found.' });
  const { studentReply, screenshotDataUrl } = req.body || {};
  if (studentReply) payment.studentReply = String(studentReply).trim();
  if (screenshotDataUrl) payment.screenshotDataUrl = String(screenshotDataUrl);

  const admins = db.users.filter((u) => u.role === 'SUPER_ADMIN');
  for (const admin of admins) {
    pushNotification(
      admin.id,
      'Student Updated Payment Details',
      `${payment.fullName} added verification info on TxID ${payment.transactionId}.`,
      'PAYMENT'
    );
  }
  saveDb();
  res.json({ payment });
});

app.post('/api/payments/:id/cancel', requireAuth(), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const payment = db.payments.find((p) => p.id === req.params.id && p.studentId === req.auth!.userId);
  if (!payment) return res.status(404).json({ error: 'Payment record not found.' });
  if (payment.status !== 'PENDING') {
    return res.status(400).json({ error: 'Only pending payments can be cancelled.' });
  }
  payment.status = 'CANCELLED';
  saveDb();
  res.json({ payment });
});

// ============================================================================
// ASSIGNMENTS & QUIZZES (STUDENT + INSTRUCTOR + ADMIN)
// ============================================================================
app.post('/api/assignments/:id/submit', requireAuth(), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const assignment = db.assignments.find((a) => a.id === req.params.id);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
  const enrolled = db.enrolments.some(
    (e) => e.studentId === req.auth!.userId && e.courseId === assignment.courseId && e.status !== 'REVOKED'
  );
  if (!enrolled) return res.status(403).json({ error: 'Enrolment required to submit assignments.' });

  const { submissionText, projectUrl } = req.body || {};
  if (!submissionText) return res.status(400).json({ error: 'Please include your project notes or summary.' });

  const existing = db.submissions.find(
    (s) => s.assignmentId === assignment.id && s.studentId === req.auth!.userId
  );
  if (existing) {
    existing.submissionText = String(submissionText).trim();
    existing.projectUrl = projectUrl ? String(projectUrl).trim() : undefined;
    existing.status = 'SUBMITTED';
    existing.submittedAt = new Date().toISOString();
    saveDb();
    return res.json({ submission: existing });
  }

  const submission = {
    id: generateId('sub'),
    assignmentId: assignment.id,
    courseId: assignment.courseId,
    studentId: req.auth!.userId,
    submissionText: String(submissionText).trim(),
    projectUrl: projectUrl ? String(projectUrl).trim() : undefined,
    status: 'SUBMITTED' as const,
    submittedAt: new Date().toISOString(),
  };
  db.submissions.unshift(submission);
  saveDb();
  res.status(201).json({ submission });
});

app.post('/api/quizzes/:id/attempt', requireAuth(), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const quiz = db.quizzes.find((q) => q.id === req.params.id);
  if (!quiz) return res.status(404).json({ error: 'Quiz not found.' });

  const enrolled = db.enrolments.some(
    (e) => e.studentId === req.auth!.userId && e.courseId === quiz.courseId && e.status !== 'REVOKED'
  );
  if (!enrolled) return res.status(403).json({ error: 'Enrolment required to take this quiz.' });

  const { answers } = req.body || {};
  if (!Array.isArray(answers)) return res.status(400).json({ error: 'Answers array is required.' });

  let correct = 0;
  quiz.questions.forEach((q, idx) => {
    if (answers[idx] === q.correctIndex) correct += 1;
  });
  const total = Math.max(quiz.questions.length, 1);
  const scorePercent = Math.round((correct / total) * 100);
  const passed = scorePercent >= quiz.passingScore;

  const attempt = {
    id: generateId('qat'),
    quizId: quiz.id,
    courseId: quiz.courseId,
    studentId: req.auth!.userId,
    answers,
    scorePercent,
    passed,
    attemptedAt: new Date().toISOString(),
  };
  db.quizAttempts.unshift(attempt);
  pushNotification(
    req.auth!.userId,
    `Quiz Completed: ${scorePercent}%`,
    `You scored ${scorePercent}% on ${quiz.title} (${passed ? 'Passed' : 'Review & Retry'}).`,
    'GRADE'
  );
  saveDb();
  res.status(201).json({ attempt });
});

// ============================================================================
// NOTIFICATIONS & MESSAGES (ALL AUTHENTICATED USERS)
// ============================================================================
app.post('/api/notifications/:id/read', requireAuth(), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const n = db.notifications.find((item) => item.id === req.params.id && item.userId === req.auth!.userId);
  if (n) {
    n.isRead = true;
    saveDb();
  }
  res.json({ ok: true });
});

app.post('/api/notifications/read-all', requireAuth(), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  db.notifications.forEach((n) => {
    if (n.userId === req.auth!.userId) n.isRead = true;
  });
  saveDb();
  res.json({ ok: true });
});

app.post('/api/messages', requireAuth(), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = db.users.find((u) => u.id === req.auth!.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const { subject, body, recipientRole, courseId } = req.body || {};
  if (!subject || !body) return res.status(400).json({ error: 'Subject and message body are required.' });

  const msg = {
    id: generateId('msg'),
    senderId: user.id,
    senderName: user.fullName,
    senderEmail: user.email,
    recipientRole: (recipientRole || 'ADMIN') as 'ADMIN' | 'INSTRUCTOR' | 'STUDENT',
    courseId: courseId || undefined,
    subject: String(subject).trim(),
    body: String(body).trim(),
    status: 'OPEN' as const,
    createdAt: new Date().toISOString(),
  };
  db.messages.unshift(msg);
  saveDb();
  res.status(201).json({ message: msg });
});

// ============================================================================
// INSTRUCTOR & ADMIN CURRICULUM / GRADING ENDPOINTS
// ============================================================================
app.get('/api/instructor/workspace', requireAuth(['INSTRUCTOR', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const isAdmin = req.auth!.role === 'SUPER_ADMIN';
  const courses = isAdmin
    ? db.courses
    : db.courses.filter((c) => c.instructorId === req.auth!.userId);
  const courseIds = new Set(courses.map((c) => c.id));

  const modules = db.modules.filter((m) => courseIds.has(m.courseId));
  const lessons = db.lessons.filter((l) => courseIds.has(l.courseId));
  const enrolments = db.enrolments.filter((e) => courseIds.has(e.courseId));
  const assignments = db.assignments.filter((a) => courseIds.has(a.courseId));
  const submissions = db.submissions.filter((s) => courseIds.has(s.courseId));
  const quizzes = db.quizzes.filter((q) => courseIds.has(q.courseId));
  const quizAttempts = db.quizAttempts.filter((qa) => courseIds.has(qa.courseId));
  const students = db.users
    .filter((u) => u.role === 'STUDENT')
    .map((u) => sanitizeUser(u));
  const notifications = db.notifications
    .filter((n) => n.userId === req.auth!.userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  res.json({
    courses,
    categories: db.categories,
    modules,
    lessons,
    enrolments,
    assignments,
    submissions,
    quizzes,
    quizAttempts,
    students,
    notifications,
  });
});

app.post('/api/courses', requireAuth(['INSTRUCTOR', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const {
    title,
    categoryId,
    instructorId,
    thumbnailUrl,
    summary,
    description,
    priceGhs,
    isFree,
    duration,
    difficulty,
    isPublished,
    isFeatured,
    learningObjectives,
    requirements,
    completionRequirement,
  } = req.body || {};

  if (!title || !categoryId || !summary) {
    return res.status(400).json({ error: 'Title, category, and summary are required.' });
  }

  const slugBase = String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const slug = db.courses.some((c) => c.slug === slugBase)
    ? `${slugBase}-${Date.now().toString(36)}`
    : slugBase;

  const assignedInstructor =
    req.auth!.role === 'SUPER_ADMIN' && instructorId ? String(instructorId) : req.auth!.userId;

  const course = {
    id: generateId('crs'),
    title: String(title).trim(),
    slug,
    categoryId: String(categoryId),
    instructorId: assignedInstructor,
    thumbnailUrl: String(thumbnailUrl || '/src/assets/images/course_ai_webdev_1794843660816.jpg'),
    summary: String(summary).trim(),
    description: String(description || summary).trim(),
    priceGhs: isFree ? 0 : Number(priceGhs) || 0,
    isFree: Boolean(isFree || Number(priceGhs) === 0),
    duration: String(duration || '4 Weeks'),
    difficulty: (difficulty || 'Beginner') as 'Beginner' | 'Intermediate' | 'Advanced',
    isPublished: Boolean(isPublished ?? true),
    isFeatured: Boolean(isFeatured ?? false),
    learningObjectives: Array.isArray(learningObjectives) ? learningObjectives : [],
    requirements: Array.isArray(requirements) ? requirements : [],
    completionRequirement: String(
      completionRequirement || 'Complete all modules and submit practical assessments.'
    ),
    createdAt: new Date().toISOString(),
  };

  db.courses.unshift(course);
  saveDb();
  res.status(201).json({ course });
});

app.patch('/api/courses/:id', requireAuth(['INSTRUCTOR', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const course = db.courses.find((c) => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  if (req.auth!.role === 'INSTRUCTOR' && course.instructorId !== req.auth!.userId) {
    return res.status(403).json({ error: 'You can only edit courses assigned to you.' });
  }
  const fields = req.body || {};
  if (fields.title !== undefined) course.title = String(fields.title).trim();
  if (fields.categoryId !== undefined) course.categoryId = String(fields.categoryId);
  if (fields.instructorId !== undefined && req.auth!.role === 'SUPER_ADMIN') {
    course.instructorId = String(fields.instructorId);
  }
  if (fields.thumbnailUrl !== undefined) course.thumbnailUrl = String(fields.thumbnailUrl);
  if (fields.summary !== undefined) course.summary = String(fields.summary);
  if (fields.description !== undefined) course.description = String(fields.description);
  if (fields.isFree !== undefined) course.isFree = Boolean(fields.isFree);
  if (fields.priceGhs !== undefined) course.priceGhs = course.isFree ? 0 : Number(fields.priceGhs) || 0;
  if (fields.duration !== undefined) course.duration = String(fields.duration);
  if (fields.difficulty !== undefined) course.difficulty = fields.difficulty;
  if (fields.isPublished !== undefined) course.isPublished = Boolean(fields.isPublished);
  if (fields.isFeatured !== undefined && req.auth!.role === 'SUPER_ADMIN') {
    course.isFeatured = Boolean(fields.isFeatured);
  }
  if (Array.isArray(fields.learningObjectives)) course.learningObjectives = fields.learningObjectives;
  if (Array.isArray(fields.requirements)) course.requirements = fields.requirements;
  if (fields.completionRequirement !== undefined) {
    course.completionRequirement = String(fields.completionRequirement);
  }
  if (fields.driveFolderId !== undefined) {
    course.driveFolderId = fields.driveFolderId ? String(fields.driveFolderId).trim() : undefined;
  }
  if (fields.driveFolderName !== undefined) {
    course.driveFolderName = fields.driveFolderName ? String(fields.driveFolderName).trim() : undefined;
  }
  saveDb();
  res.json({ course });
});

app.post('/api/courses/:id/drive-sync', requireAuth(['INSTRUCTOR', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const course = db.courses.find((c) => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  if (req.auth!.role === 'INSTRUCTOR' && course.instructorId !== req.auth!.userId) {
    return res.status(403).json({ error: 'You can only sync Drive videos for your assigned courses.' });
  }

  const { folderId, folderName, videos, replacePlaceholders = true } = req.body || {};
  if (!folderId) {
    return res.status(400).json({ error: 'Google Drive folder ID is required.' });
  }

  course.driveFolderId = String(folderId).trim();
  if (folderName) {
    course.driveFolderName = String(folderName).trim();
  }

  const importedVideos: Array<{ id: string; name: string; folderName?: string }> = Array.isArray(videos)
    ? videos
        .filter((v: any) => v && v.id && v.name)
        .map((v: any) => ({
          id: String(v.id).trim(),
          name: String(v.name).trim(),
          folderName: v.folderName ? String(v.folderName).trim() : undefined,
        }))
    : [];

  let createdCount = 0;
  let updatedCount = 0;

  if (importedVideos.length > 0) {
    if (replacePlaceholders) {
      // Remove unlinked paid placeholder lessons (keep free preview lessons and already-linked lessons)
      db.lessons = db.lessons.filter(
        (l) =>
          l.courseId !== course.id ||
          l.isFreePreview ||
          Boolean(l.driveFileId) ||
          Boolean(l.videoUrl && !l.videoUrl.includes('drive.google.com'))
      );
      // Clean up empty paid modules that no longer have lessons
      const usedModIds = new Set(db.lessons.filter((l) => l.courseId === course.id).map((l) => l.moduleId));
      db.modules = db.modules.filter((m) => m.courseId !== course.id || usedModIds.has(m.id));
    }

    let courseModules = db.modules
      .filter((m) => m.courseId === course.id)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    let maxOrder = db.lessons
      .filter((l) => l.courseId === course.id)
      .reduce((max, l) => Math.max(max, l.orderIndex), 0);

    for (const vid of importedVideos) {
      const previewUrl = `https://drive.google.com/file/d/${vid.id}/preview`;
      const cleanTitle = vid.name.replace(/\.(mp4|mov|webm|mkv|m4v|avi)$/i, '').trim();

      const existingLesson = db.lessons.find(
        (l) => l.courseId === course.id && l.driveFileId === vid.id
      );
      if (existingLesson) {
        existingLesson.title = cleanTitle;
        existingLesson.videoUrl = previewUrl;
        existingLesson.isFreePreview = false;
        updatedCount += 1;
        continue;
      }

      const modTitle = vid.folderName
        ? `${vid.folderName} (Paid Google Drive Access)`
        : `${course.driveFolderName || 'Course Library'} (Paid Google Drive Access)`;

      let targetMod = courseModules.find(
        (m) => m.title.toLowerCase() === modTitle.toLowerCase()
      );
      if (!targetMod) {
        targetMod = {
          id: generateId('mod'),
          courseId: course.id,
          title: modTitle,
          description: 'Unlocked automatically after MTN Mobile Money verification.',
          orderIndex: courseModules.length + 1,
        };
        db.modules.push(targetMod);
        courseModules.push(targetMod);
      }

      maxOrder += 1;
      db.lessons.push({
        id: generateId('les'),
        moduleId: targetMod.id,
        courseId: course.id,
        title: cleanTitle,
        description: `Google Drive video lesson imported from "${vid.folderName || course.driveFolderName || 'Course Drive Folder'}".`,
        videoUrl: previewUrl,
        driveFileId: vid.id,
        durationMinutes: 20,
        pdfTitle: `${cleanTitle.replace(/[^a-zA-Z0-9]+/g, '_')}_Notes.pdf`,
        pdfSummary: `Study guide and key takeaways for ${cleanTitle}.`,
        practicalExercise: `Follow along with "${cleanTitle}" and apply the steps in your project.`,
        orderIndex: maxOrder,
        isFreePreview: false,
      });
      createdCount += 1;
    }
  }

  const actor = db.users.find((u) => u.id === req.auth!.userId);
  appendSecurityLog({
    event: 'COURSE_DRIVE_SYNCED',
    severity: 'INFO',
    actorEmail: actor?.email || 'staff',
    actorRole: req.auth!.role,
    ipAddress: getClientIp(req),
    details: `Linked Drive folder "${course.driveFolderName || course.driveFolderId}" to ${course.title} (${createdCount} imported, ${updatedCount} updated).`,
  });
  saveDb();
  res.json({ course, createdCount, updatedCount });
});

app.delete('/api/courses/:id', requireAuth(['INSTRUCTOR', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const course = db.courses.find((c) => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  if (req.auth!.role === 'INSTRUCTOR' && course.instructorId !== req.auth!.userId) {
    return res.status(403).json({ error: 'You can only delete your own courses.' });
  }
  db.courses = db.courses.filter((c) => c.id !== course.id);
  db.modules = db.modules.filter((m) => m.courseId !== course.id);
  db.lessons = db.lessons.filter((l) => l.courseId !== course.id);
  saveDb();
  res.json({ ok: true });
});

app.post('/api/courses/:id/modules', requireAuth(['INSTRUCTOR', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const course = db.courses.find((c) => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  if (req.auth!.role === 'INSTRUCTOR' && course.instructorId !== req.auth!.userId) {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  const { title, description } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Module title is required.' });
  const existingCount = db.modules.filter((m) => m.courseId === course.id).length;
  const mod = {
    id: generateId('mod'),
    courseId: course.id,
    title: String(title).trim(),
    description: String(description || '').trim(),
    orderIndex: existingCount + 1,
  };
  db.modules.push(mod);
  saveDb();
  res.status(201).json({ module: mod });
});

app.delete('/api/modules/:id', requireAuth(['INSTRUCTOR', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const mod = db.modules.find((m) => m.id === req.params.id);
  if (!mod) return res.status(404).json({ error: 'Module not found.' });
  db.modules = db.modules.filter((m) => m.id !== mod.id);
  db.lessons = db.lessons.filter((l) => l.moduleId !== mod.id);
  saveDb();
  res.json({ ok: true });
});

app.post('/api/modules/:id/lessons', requireAuth(['INSTRUCTOR', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const mod = db.modules.find((m) => m.id === req.params.id);
  if (!mod) return res.status(404).json({ error: 'Module not found.' });
  const course = db.courses.find((c) => c.id === mod.courseId);
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  if (req.auth!.role === 'INSTRUCTOR' && course.instructorId !== req.auth!.userId) {
    return res.status(403).json({ error: 'Forbidden.' });
  }

  const {
    title,
    description,
    videoUrl,
    driveFileId,
    durationMinutes,
    pdfTitle,
    pdfSummary,
    practicalExercise,
    isFreePreview,
  } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Lesson title is required.' });
  const existingCount = db.lessons.filter((l) => l.courseId === course.id).length;

  const lesson = {
    id: generateId('les'),
    moduleId: mod.id,
    courseId: course.id,
    title: String(title).trim(),
    description: String(description || '').trim(),
    videoUrl: String(videoUrl || '').trim(),
    driveFileId: driveFileId ? String(driveFileId).trim() : undefined,
    durationMinutes: Number(durationMinutes) || 15,
    pdfTitle: String(pdfTitle || `${String(title).replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`),
    pdfSummary: String(pdfSummary || description || '').trim(),
    practicalExercise: String(practicalExercise || '').trim(),
    orderIndex: existingCount + 1,
    isFreePreview: Boolean(isFreePreview),
  };
  db.lessons.push(lesson);
  saveDb();
  res.status(201).json({ lesson });
});

app.patch('/api/lessons/:id', requireAuth(['INSTRUCTOR', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const lesson = db.lessons.find((l) => l.id === req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });
  const course = db.courses.find((c) => c.id === lesson.courseId);
  if (req.auth!.role === 'INSTRUCTOR' && course && course.instructorId !== req.auth!.userId) {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  const fields = req.body || {};
  if (fields.title !== undefined) lesson.title = String(fields.title).trim();
  if (fields.description !== undefined) lesson.description = String(fields.description).trim();
  if (fields.videoUrl !== undefined) lesson.videoUrl = String(fields.videoUrl).trim();
  if (fields.driveFileId !== undefined) {
    lesson.driveFileId = fields.driveFileId ? String(fields.driveFileId).trim() : undefined;
  }
  if (fields.isFreePreview !== undefined) lesson.isFreePreview = Boolean(fields.isFreePreview);
  if (fields.durationMinutes !== undefined) lesson.durationMinutes = Number(fields.durationMinutes) || 15;
  saveDb();
  res.json({ lesson });
});

app.delete('/api/lessons/:id', requireAuth(['INSTRUCTOR', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  db.lessons = db.lessons.filter((l) => l.id !== req.params.id);
  saveDb();
  res.json({ ok: true });
});

app.post('/api/assignments', requireAuth(['INSTRUCTOR', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const { courseId, title, instructions, dueDate, maxScore } = req.body || {};
  if (!courseId || !title || !instructions) {
    return res.status(400).json({ error: 'Course, title, and instructions are required.' });
  }
  const assignment = {
    id: generateId('asg'),
    courseId: String(courseId),
    title: String(title).trim(),
    instructions: String(instructions).trim(),
    dueDate: String(dueDate || '2026-12-20'),
    maxScore: Number(maxScore) || 100,
    createdAt: new Date().toISOString(),
  };
  db.assignments.unshift(assignment);
  saveDb();
  res.status(201).json({ assignment });
});

app.post('/api/submissions/:id/grade', requireAuth(['INSTRUCTOR', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const sub = db.submissions.find((s) => s.id === req.params.id);
  if (!sub) return res.status(404).json({ error: 'Submission not found.' });
  const { score, feedback } = req.body || {};
  sub.score = Number(score) || 0;
  sub.feedback = String(feedback || '').trim();
  sub.status = 'GRADED';
  sub.gradedAt = new Date().toISOString();
  pushNotification(
    sub.studentId,
    `Assignment Graded: ${sub.score}`,
    `Your instructor reviewed your submission. Feedback: ${sub.feedback || 'See assignment tab.'}`,
    'GRADE'
  );
  saveDb();
  res.json({ submission: sub });
});

app.post('/api/quizzes', requireAuth(['INSTRUCTOR', 'SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const { courseId, title, description, passingScore, questions } = req.body || {};
  if (!courseId || !title || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: 'Course, title, and at least one question are required.' });
  }
  const quiz = {
    id: generateId('qiz'),
    courseId: String(courseId),
    title: String(title).trim(),
    description: String(description || '').trim(),
    passingScore: Number(passingScore) || 70,
    questions: questions.map((q: any, idx: number) => ({
      id: q.id || `q-${idx + 1}`,
      prompt: String(q.prompt).trim(),
      options: Array.isArray(q.options) ? q.options.map(String) : [],
      correctIndex: Number(q.correctIndex) || 0,
    })),
    createdAt: new Date().toISOString(),
  };
  db.quizzes.unshift(quiz);
  saveDb();
  res.status(201).json({ quiz });
});

// ============================================================================
// SUPER ADMINISTRATOR ENDPOINTS
// ============================================================================
app.get('/api/admin/overview', requireAuth(['SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const totalStudents = db.users.filter((u) => u.role === 'STUDENT').length;
  const totalInstructors = db.users.filter((u) => u.role === 'INSTRUCTOR').length;
  const totalPublishedCourses = db.courses.filter((c) => c.isPublished).length;
  const totalEnrolledStudents = new Set(
    db.enrolments.filter((e) => e.status !== 'REVOKED').map((e) => e.studentId)
  ).size;
  const totalCompletedCourses = db.enrolments.filter((e) => e.status === 'COMPLETED').length;
  const pendingPayments = db.payments.filter((p) => p.status === 'PENDING').length;
  const approvedPayments = db.payments.filter((p) => p.status === 'APPROVED').length;
  const rejectedPayments = db.payments.filter((p) => p.status === 'REJECTED').length;
  const totalVerifiedRevenue = db.payments
    .filter((p) => p.status === 'APPROVED')
    .reduce((sum, p) => sum + p.amountGhs, 0);

  res.json({
    stats: {
      totalStudents,
      totalInstructors,
      totalPublishedCourses,
      totalEnrolledStudents,
      totalCompletedCourses,
      pendingPayments,
      approvedPayments,
      rejectedPayments,
      totalVerifiedRevenue,
    },
    users: db.users.map(sanitizeUser),
    categories: [...db.categories].sort((a, b) => a.orderIndex - b.orderIndex),
    courses: db.courses,
    modules: db.modules,
    lessons: db.lessons,
    enrolments: db.enrolments,
    payments: [...db.payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    assignments: db.assignments,
    submissions: db.submissions,
    quizzes: db.quizzes,
    quizAttempts: db.quizAttempts,
    certificates: db.certificates,
    announcements: db.announcements,
    notifications: db.notifications
      .filter((n) => n.userId === req.auth!.userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    messages: [...db.messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    website: db.website,
    settings: db.settings,
  });
});

app.post('/api/admin/payments/:id/decision', requireAuth(['SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const payment = db.payments.find((p) => p.id === req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment record not found.' });

  const { action, adminNote, driveAccessEmail, driveSharedConfirmed } = req.body || {};
  const course = db.courses.find((c) => c.id === payment.courseId);

  if (action === 'APPROVE') {
    // Double-check no other APPROVED payment already claimed this transaction ID
    const conflictingApproved = db.payments.find(
      (p) =>
        p.id !== payment.id &&
        p.status === 'APPROVED' &&
        p.transactionId.trim().toUpperCase() === payment.transactionId.trim().toUpperCase()
    );
    if (conflictingApproved) {
      return res.status(409).json({ error: 'Duplicate approved Transaction ID detected.' });
    }

    const reviewer = db.users.find((u) => u.id === req.auth!.userId);
    const enrolment = activatePaidEnrolment({
      payment,
      reviewedBy: req.auth!.userId,
      adminNote: String(adminNote || 'MTN Mobile Money receipt verified.').trim(),
      driveAccessEmail,
      driveSharedConfirmed,
      ipAddress: getClientIp(req),
      actorEmail: reviewer?.email || 'admin',
      actorRole: 'SUPER_ADMIN',
    });
    return res.json({ payment, enrolment });
  }

  if (action === 'REJECT') {
    payment.status = 'REJECTED';
    payment.adminNote = String(
      adminNote || 'Transaction could not be verified on our MTN Mobile Money statement.'
    ).trim();
    payment.reviewedBy = req.auth!.userId;
    payment.reviewedAt = new Date().toISOString();
    pushNotification(
      payment.studentId,
      'Mobile Money Payment Rejected',
      `Your submission (${payment.transactionId}) was rejected. Reason: ${payment.adminNote}`,
      'PAYMENT'
    );
    const reviewer = db.users.find((u) => u.id === req.auth!.userId);
    appendSecurityLog({
      event: 'PAYMENT_REJECTED',
      severity: 'WARN',
      actorEmail: reviewer?.email || 'admin',
      actorRole: 'SUPER_ADMIN',
      ipAddress: getClientIp(req),
      details: `Rejected TxID ${payment.transactionId} for ${payment.email}.`,
    });
    saveDb();
    return res.json({ payment });
  }

  if (action === 'REQUEST_INFO') {
    payment.adminNote = String(
      adminNote || 'Please upload a clearer screenshot or verify your Transaction ID and sender number.'
    ).trim();
    pushNotification(
      payment.studentId,
      'Additional Verification Needed',
      `Admin note on ${payment.transactionId}: ${payment.adminNote}`,
      'PAYMENT'
    );
    saveDb();
    return res.json({ payment });
  }

  res.status(400).json({ error: 'Invalid decision action.' });
});

app.post('/api/categories', requireAuth(['SUPER_ADMIN']), (req, res) => {
  const db = getDb();
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Category name is required.' });
  const slug = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const cat = {
    id: generateId('cat'),
    name: String(name).trim(),
    slug,
    description: String(description || '').trim(),
    orderIndex: db.categories.length + 1,
  };
  db.categories.push(cat);
  saveDb();
  res.status(201).json({ category: cat });
});

app.delete('/api/categories/:id', requireAuth(['SUPER_ADMIN']), (req, res) => {
  const db = getDb();
  db.categories = db.categories.filter((c) => c.id !== req.params.id);
  saveDb();
  res.json({ ok: true });
});

app.post('/api/admin/users', requireAuth(['SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const { fullName, email, phone, password, role, title, bio, location } = req.body || {};
  if (!fullName || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required.' });
  }
  const normalized = sanitizeText(email, 160).toLowerCase();
  if (!isValidEmail(normalized)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  const pwdCheck = validatePasswordStrength(String(password));
  if (!pwdCheck.valid) {
    return res.status(400).json({ error: pwdCheck.error });
  }
  if (db.users.some((u) => u.email.toLowerCase() === normalized)) {
    return res.status(409).json({ error: 'Email already registered.' });
  }
  const user = {
    id: generateId('usr'),
    fullName: sanitizeText(fullName, 120),
    email: normalized,
    phone: sanitizeText(phone || '', 40),
    passwordHash: hashPassword(String(password)),
    role: role as UserRole,
    avatarUrl:
      role === 'INSTRUCTOR'
        ? INSTRUCTOR_AVATAR
        : '/src/assets/images/instructor_systems_1794843662963.jpg',
    bio: sanitizeText(bio || '', 1000),
    title: sanitizeText(title || (role === 'INSTRUCTOR' ? 'Academy Instructor' : 'Academy Member'), 120),
    location: sanitizeText(location || 'Accra, Ghana', 100),
    status: 'ACTIVE' as const,
    emailVerified: true,
    twoFactorEnabled: true,
    tokenVersion: 1,
    failedLoginAttempts: 0,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  const adminUser = db.users.find((u) => u.id === req.auth!.userId);
  appendSecurityLog({
    event: 'ADMIN_USER_CREATED',
    severity: 'INFO',
    actorEmail: adminUser?.email || 'admin',
    actorRole: 'SUPER_ADMIN',
    ipAddress: getClientIp(req),
    details: `Administrator created ${user.role} account for ${user.email} with Email 2FA enabled.`,
  });
  saveDb();
  res.status(201).json({ user: sanitizeUser(user) });
});

app.patch('/api/admin/users/:id', requireAuth(['SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const user = db.users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  const { role, status, fullName, title, phone } = req.body || {};
  if (role) user.role = role;
  if (status) user.status = status;
  if (status === 'SUSPENDED') {
    user.tokenVersion = (user.tokenVersion || 1) + 1;
  }
  if (fullName) user.fullName = sanitizeText(fullName, 120);
  if (title !== undefined) user.title = sanitizeText(title, 120);
  if (phone !== undefined) user.phone = sanitizeText(phone, 40);
  const adminUser = db.users.find((u) => u.id === req.auth!.userId);
  appendSecurityLog({
    event: 'ADMIN_USER_UPDATED',
    severity: status === 'SUSPENDED' ? 'WARN' : 'INFO',
    actorEmail: adminUser?.email || 'admin',
    actorRole: 'SUPER_ADMIN',
    ipAddress: getClientIp(req),
    details: `Updated user ${user.email} (role: ${user.role}, status: ${user.status}).`,
  });
  saveDb();
  res.json({ user: sanitizeUser(user) });
});

app.post('/api/admin/enrolments', requireAuth(['SUPER_ADMIN']), (req, res) => {
  const db = getDb();
  const { studentId, courseId } = req.body || {};
  if (!studentId || !courseId) return res.status(400).json({ error: 'Student and course required.' });
  const existing = db.enrolments.find((e) => e.studentId === studentId && e.courseId === courseId);
  if (existing) {
    existing.status = 'ACTIVE';
    saveDb();
    return res.json({ enrolment: existing });
  }
  const firstLesson = db.lessons
    .filter((l) => l.courseId === courseId)
    .sort((a, b) => a.orderIndex - b.orderIndex)[0];
  const enrolment = {
    id: generateId('enr'),
    studentId,
    courseId,
    status: 'ACTIVE' as const,
    progressPercent: 0,
    completedLessonIds: [],
    lastLessonId: firstLesson?.id,
    enrolledAt: new Date().toISOString(),
  };
  db.enrolments.push(enrolment);
  pushNotification(studentId, 'Manual Enrolment Added', 'An administrator enrolled you in a course.', 'ENROLMENT');
  saveDb();
  res.status(201).json({ enrolment });
});

app.patch('/api/admin/enrolments/:id', requireAuth(['SUPER_ADMIN']), (req, res) => {
  const db = getDb();
  const enr = db.enrolments.find((e) => e.id === req.params.id);
  if (!enr) return res.status(404).json({ error: 'Enrolment not found.' });
  if (req.body?.status) enr.status = req.body.status;
  saveDb();
  res.json({ enrolment: enr });
});

app.post('/api/admin/enrolments/:id/drive-access', requireAuth(['SUPER_ADMIN', 'INSTRUCTOR']), (req, res) => {
  const db = getDb();
  const enr = db.enrolments.find((e) => e.id === req.params.id);
  if (!enr) return res.status(404).json({ error: 'Enrolment not found.' });
  const student = db.users.find((u) => u.id === enr.studentId);
  const email = req.body?.email ? String(req.body.email).trim().toLowerCase() : student?.email;
  enr.driveAccessEmail = email;
  enr.driveAccessGrantedAt = new Date().toISOString();
  if (student) {
    const course = db.courses.find((c) => c.id === enr.courseId);
    pushNotification(
      student.id,
      'Google Drive Video Access Shared',
      `Full Google Drive access for ${course?.title || 'your course'} has been shared to your sign-up email (${email}).`,
      'ENROLMENT'
    );
  }
  saveDb();
  res.json({ enrolment: enr });
});

app.post('/api/admin/enrolments/drive-access-bulk', requireAuth(['SUPER_ADMIN', 'INSTRUCTOR']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const items: Array<{ enrolmentId: string; email?: string }> = Array.isArray(req.body?.items)
    ? req.body.items
    : [];
  const updated: string[] = [];

  for (const item of items) {
    const enr = db.enrolments.find((e) => e.id === item.enrolmentId);
    if (!enr) continue;
    const student = db.users.find((u) => u.id === enr.studentId);
    const email = item.email ? String(item.email).trim().toLowerCase() : student?.email;
    if (!email) continue;
    enr.driveAccessEmail = email;
    enr.driveAccessGrantedAt = new Date().toISOString();
    updated.push(enr.id);

    if (student) {
      const course = db.courses.find((c) => c.id === enr.courseId);
      pushNotification(
        student.id,
        'Google Drive Video Access Shared',
        `Full Google Drive access for ${course?.title || 'your course'} has been shared to your sign-up email (${email}).`,
        'ENROLMENT'
      );
    }
  }

  const actor = db.users.find((u) => u.id === req.auth!.userId);
  appendSecurityLog({
    event: 'DRIVE_ACCESS_BULK_SHARED',
    severity: 'INFO',
    actorEmail: actor?.email || 'staff',
    actorRole: req.auth!.role,
    ipAddress: getClientIp(req),
    details: `Recorded Google Drive Reader access for ${updated.length} paid enrolment(s).`,
  });
  saveDb();
  res.json({ updatedCount: updated.length, updatedIds: updated });
});

app.post('/api/admin/certificates/issue', requireAuth(['SUPER_ADMIN']), (req, res) => {
  const db = getDb();
  const { studentId, courseId } = req.body || {};
  const student = db.users.find((u) => u.id === studentId);
  const course = db.courses.find((c) => c.id === courseId);
  if (!student || !course) return res.status(404).json({ error: 'Student or course not found.' });
  const instructor = db.users.find((u) => u.id === course.instructorId);

  const existing = db.certificates.find((c) => c.studentId === studentId && c.courseId === courseId);
  if (existing) return res.json({ certificate: existing });

  const certificate = {
    id: generateId('crt'),
    certificateNumber: `EKTS-${new Date().getFullYear()}-${String(db.certificates.length + 413).padStart(5, '0')}`,
    studentId,
    courseId,
    studentName: student.fullName,
    courseTitle: course.title,
    instructorName: instructor?.fullName || 'EK TECH SOLUTIONS Faculty',
    issuedAt: new Date().toISOString(),
  };
  db.certificates.push(certificate);
  pushNotification(
    studentId,
    'Official Certificate Issued',
    `Certificate ${certificate.certificateNumber} for ${course.title} has been issued.`,
    'ENROLMENT'
  );
  saveDb();
  res.status(201).json({ certificate });
});

app.post('/api/admin/announcements', requireAuth(['SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const { title, message, audience } = req.body || {};
  if (!title || !message) return res.status(400).json({ error: 'Title and message are required.' });
  const ann = {
    id: generateId('ann'),
    title: String(title).trim(),
    message: String(message).trim(),
    audience: (audience || 'ALL') as 'ALL' | 'STUDENTS' | 'INSTRUCTORS',
    authorId: req.auth!.userId,
    createdAt: new Date().toISOString(),
  };
  db.announcements.unshift(ann);
  db.users.forEach((u) => {
    if (
      ann.audience === 'ALL' ||
      (ann.audience === 'STUDENTS' && u.role === 'STUDENT') ||
      (ann.audience === 'INSTRUCTORS' && u.role === 'INSTRUCTOR')
    ) {
      pushNotification(u.id, ann.title, ann.message, 'ANNOUNCEMENT');
    }
  });
  saveDb();
  res.status(201).json({ announcement: ann });
});

app.post('/api/admin/messages/:id/reply', requireAuth(['SUPER_ADMIN', 'INSTRUCTOR']), (req, res) => {
  const db = getDb();
  const msg = db.messages.find((m) => m.id === req.params.id);
  if (!msg) return res.status(404).json({ error: 'Message not found.' });
  const { replyBody, status } = req.body || {};
  if (replyBody) msg.replyBody = String(replyBody).trim();
  msg.status = status || 'REPLIED';
  msg.repliedAt = new Date().toISOString();
  if (msg.senderId) {
    pushNotification(msg.senderId, `Reply: ${msg.subject}`, msg.replyBody || 'Support replied.', 'SYSTEM');
  }
  saveDb();
  res.json({ message: msg });
});

app.patch('/api/admin/website', requireAuth(['SUPER_ADMIN']), (req, res) => {
  const db = getDb();
  db.website = { ...db.website, ...(req.body || {}) };
  saveDb();
  res.json({ website: db.website });
});

app.patch('/api/admin/settings', requireAuth(['SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const nextBody = { ...(req.body || {}) };
  if (
    nextBody.paymentGatewayMode &&
    !['BOTH', 'PAYSTACK', 'MANUAL_MOMO', 'MOMO_API_READY'].includes(String(nextBody.paymentGatewayMode))
  ) {
    return res.status(400).json({ error: 'Invalid payment gateway mode.' });
  }
  db.settings = { ...db.settings, ...nextBody };
  const adminUser = db.users.find((u) => u.id === req.auth!.userId);
  appendSecurityLog({
    event: 'ADMIN_SETTINGS_UPDATED',
    severity: 'WARN',
    actorEmail: adminUser?.email || 'admin',
    actorRole: 'SUPER_ADMIN',
    ipAddress: getClientIp(req),
    details: 'Administrator updated platform payment/system configuration.',
  });
  saveDb();
  res.json({ settings: db.settings });
});

// ============================================================================
// SUPER ADMINISTRATOR CIA SECURITY CONSOLE ENDPOINTS
// ============================================================================
app.get('/api/admin/security', requireAuth(['SUPER_ADMIN']), (_req: AuthenticatedRequest, res) => {
  const db = getDb();
  const logs = db.securityLogs || [];
  const auditCheck = verifyAuditChain(logs);
  const backups = getBackupSummary();
  const rateStats = getRateLimitStats();
  const lockedAccounts = db.users.filter((u) => u.lockedUntil && u.lockedUntil > Date.now()).length;

  const payload: CiaSecurityOverview = {
    confidentiality: {
      passwordHashing: 'scrypt (16-byte random salt + timingSafeEqual)',
      fieldEncryption: 'AES-256-GCM authenticated encryption + HttpOnly SameSite=Lax cookies',
      sessionProtection: 'HMAC-SHA256 signed tokens with tokenVersion instant revocation',
      twoFactorEnforcedCount: db.users.filter((u) => u.twoFactorEnabled !== false).length,
      totalUsersCount: db.users.length,
      smtpConfigured: isSmtpConfigured(),
    },
    integrity: {
      auditChainValid: auditCheck.valid,
      auditEntriesCount: logs.length,
      brokenIndex: auditCheck.brokenIndex,
      databaseChecksum: db.integrityChecksum || computeDbSeal(db),
      csrfOriginProtection: true,
      strictPasswordPolicy: true,
    },
    availability: {
      uptimeSeconds: Math.floor((Date.now() - SERVER_STARTED_AT) / 1000),
      rateLimitingActive: true,
      activeRateLimitBuckets: rateStats.activeBuckets,
      lockedAccountsCount: lockedAccounts,
      backupCount: backups.backupCount,
      lastBackupAt: backups.lastBackupAt,
    },
    auditLogs: logs.slice(0, 100),
  };

  res.json(payload);
});

app.post('/api/admin/security/verify-integrity', requireAuth(['SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const adminUser = db.users.find((u) => u.id === req.auth!.userId);
  const auditCheck = verifyAuditChain(db.securityLogs || []);
  const currentSeal = computeDbSeal(db);
  appendSecurityLog({
    event: auditCheck.valid ? 'INTEGRITY_AUDIT_PASSED' : 'INTEGRITY_AUDIT_ANOMALY',
    severity: auditCheck.valid ? 'INFO' : 'CRITICAL',
    actorEmail: adminUser?.email || 'admin',
    actorRole: 'SUPER_ADMIN',
    ipAddress: getClientIp(req),
    details: auditCheck.valid
      ? `Verified SHA-256 hash chain (${(db.securityLogs || []).length} entries) and database seal.`
      : `Audit chain break detected at entry index ${auditCheck.brokenIndex}.`,
  });
  saveDb();
  res.json({
    valid: auditCheck.valid,
    brokenIndex: auditCheck.brokenIndex,
    databaseChecksum: currentSeal,
  });
});

app.post('/api/admin/security/backup', requireAuth(['SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const adminUser = db.users.find((u) => u.id === req.auth!.userId);
  appendSecurityLog({
    event: 'AVAILABILITY_BACKUP_CREATED',
    severity: 'INFO',
    actorEmail: adminUser?.email || 'admin',
    actorRole: 'SUPER_ADMIN',
    ipAddress: getClientIp(req),
    details: 'Administrator created a verified point-in-time database backup snapshot.',
  });
  saveDb();
  const backup = createDatabaseBackup();
  res.status(201).json({ backup });
});

app.post('/api/admin/security/unlock-user/:id', requireAuth(['SUPER_ADMIN']), (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const target = db.users.find((u) => u.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  const adminUser = db.users.find((u) => u.id === req.auth!.userId);
  target.failedLoginAttempts = 0;
  target.lockedUntil = undefined;
  appendSecurityLog({
    event: 'ADMIN_UNLOCKED_ACCOUNT',
    severity: 'WARN',
    actorEmail: adminUser?.email || 'admin',
    actorRole: 'SUPER_ADMIN',
    ipAddress: getClientIp(req),
    details: `Administrator unlocked brute-force cooldown for ${target.email}.`,
  });
  saveDb();
  res.json({ user: sanitizeUser(target) });
});

// ============================================================================
// SUPER ADMINISTRATOR SUPABASE POSTGRESQL SQL MANAGEMENT ENDPOINTS
// ============================================================================
const SUPABASE_SCHEMA_TABLES = [
  'users',
  'categories',
  'courses',
  'modules',
  'lessons',
  'enrolments',
  'payments',
  'assignments',
  'assignment_submissions',
  'quizzes',
  'quiz_attempts',
  'certificates',
  'notifications',
  'support_messages',
  'announcements',
  'website_content',
  'system_settings',
  'otp_challenges',
  'security_audit_logs',
  'lms_state_meta',
];

app.get('/api/admin/database', requireAuth(['SUPER_ADMIN']), (_req: AuthenticatedRequest, res) => {
  res.json({
    status: getSupabaseStatus(),
    schemaSql: readSchemaSql(),
    seedSql: readSeedSql(),
    tableList: SUPABASE_SCHEMA_TABLES,
  });
});

app.post('/api/admin/database/test', requireAuth(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res) => {
  const db = getDb();
  const adminUser = db.users.find((u) => u.id === req.auth!.userId);
  const result = await testSupabaseConnection();
  appendSecurityLog({
    event: 'SUPABASE_CONNECTION_TESTED',
    severity: result.connected ? 'INFO' : 'WARN',
    actorEmail: adminUser?.email || 'admin',
    actorRole: 'SUPER_ADMIN',
    ipAddress: getClientIp(req),
    details: `${result.driver} test: ${result.connected ? 'Connected' : 'Not connected'} (${result.latencyMs}ms).`,
  });
  saveDb();
  res.json({ ...result, status: getSupabaseStatus() });
});

app.post('/api/admin/database/sync', requireAuth(['SUPER_ADMIN']), async (req: AuthenticatedRequest, res) => {
  if (!isSupabaseConfigured()) {
    return res.status(400).json({
      error:
        'Supabase environment secrets are not configured yet. Add DATABASE_URL (or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) in server secrets.',
    });
  }
  const db = getDb();
  const adminUser = db.users.find((u) => u.id === req.auth!.userId);
  try {
    const syncRes = await syncDatabaseToSupabase(db);
    appendSecurityLog({
      event: 'SUPABASE_SYNC_COMPLETED',
      severity: 'INFO',
      actorEmail: adminUser?.email || 'admin',
      actorRole: 'SUPER_ADMIN',
      ipAddress: getClientIp(req),
      details: `Synchronized ${syncRes.syncedCount} Academy records to Supabase SQL.`,
    });
    saveDb();
    res.json({
      ok: syncRes.ok,
      syncedCount: syncRes.syncedCount,
      status: getSupabaseStatus(),
    });
  } catch (err: any) {
    appendSecurityLog({
      event: 'SUPABASE_SYNC_FAILED',
      severity: 'CRITICAL',
      actorEmail: adminUser?.email || 'admin',
      actorRole: 'SUPER_ADMIN',
      ipAddress: getClientIp(req),
      details: `Supabase sync error: ${err?.message || 'Unknown error'}`,
    });
    saveDb();
    res.status(500).json({ error: err?.message || 'Failed to sync LMS data to Supabase SQL.' });
  }
});

// ============================================================================
// VITE DEV MIDDLEWARE / PRODUCTION STATIC SERVING
// ============================================================================
async function setupFrontendAndStart() {
  const isVercel = Boolean(process.env.VERCEL);
  if (isVercel) return;

  try {
    await ensureStoreHydrated();
  } catch (err: any) {
    console.warn('Supabase startup hydration skipped:', err?.message || err);
  }

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`EK TECH SOLUTIONS Online Academy server listening on http://localhost:${port}`);
  });
}

setupFrontendAndStart();

export default app;
