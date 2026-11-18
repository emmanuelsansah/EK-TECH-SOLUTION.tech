import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { LmsDatabase, OtpChallengeRecord, StoredUser } from './seed.ts';
import type {
  Announcement,
  Assignment,
  AssignmentSubmission,
  Category,
  Certificate,
  Course,
  Enrolment,
  Lesson,
  Module,
  NotificationItem,
  Payment,
  Quiz,
  QuizAttempt,
  SecurityAuditEntry,
  SupabaseConnectionStatus,
  SupabaseTestResult,
  SupportMessage,
  SystemSettings,
  WebsiteContent,
} from '../src/types.ts';

declare global {
  var _ekSupabasePgPool: Pool | undefined;
  var _ekSupabaseAdminClient: SupabaseClient | undefined;
}

export const SUPABASE_PROJECT_REF = 'fimobcmrmdpxweaxitwq';
export const DEFAULT_SUPABASE_URL = `https://${SUPABASE_PROJECT_REF}.supabase.co`;
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbW9iY21ybWRweHdlYXhpdHdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4NTIwMTIsImV4cCI6MjExMDQyODAxMn0.jFxDgZjXfqdhWAXKKQYcFZEhsLfKCnlC23XYQLcKFjU';

let lastSyncedAt: string | null = null;
let lastSyncError: string | null = null;
let schemaBootstrapped = false;

export function getDatabaseUrl(): string {
  return (process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '').trim();
}

export function getSupabaseUrl(): string {
  const raw = (process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
  return raw.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

export function getSupabaseProjectRef(): string {
  const url = getSupabaseUrl();
  const match = url.match(/^https?:\/\/([a-z0-9-]+)\.supabase\.co/i);
  return match ? match[1] : SUPABASE_PROJECT_REF;
}

export function getSupabaseServiceKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

export function getSupabaseAnonKey(): string {
  return (process.env.SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();
}

export function getSupabaseActiveKey(): string {
  return getSupabaseServiceKey() || getSupabaseAnonKey();
}

export function hasPostgresConnection(): boolean {
  return Boolean(getDatabaseUrl());
}

export function hasSupabaseRestConnection(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseActiveKey());
}

export function hasWriteCapableSupabase(): boolean {
  return hasPostgresConnection() || Boolean(getSupabaseServiceKey());
}

export function isSupabaseConfigured(): boolean {
  return hasPostgresConnection() || hasSupabaseRestConnection();
}

export function getPgPool(): Pool | null {
  const connStr = getDatabaseUrl();
  if (!connStr) return null;
  if (!global._ekSupabasePgPool) {
    global._ekSupabasePgPool = new Pool({
      connectionString: connStr,
      ssl: connStr.includes('localhost') || connStr.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 12000,
    });
    global._ekSupabasePgPool.on('error', (err) => {
      console.error('[Supabase PG Pool Error]:', err.message);
      lastSyncError = err.message;
    });
  }
  return global._ekSupabasePgPool;
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabaseActiveKey();
  if (!url || !key) return null;
  if (!global._ekSupabaseAdminClient) {
    global._ekSupabaseAdminClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return global._ekSupabaseAdminClient;
}

export function readSchemaSql(): string {
  try {
    const p = path.resolve(process.cwd(), 'supabase', 'schema.sql');
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf8');
    }
  } catch {
    // ignore
  }
  return '';
}

export function readSeedSql(): string {
  try {
    const p = path.resolve(process.cwd(), 'supabase', 'seed.sql');
    if (fs.existsSync(p)) {
      return fs.readFileSync(p, 'utf8');
    }
  } catch {
    // ignore
  }
  return '';
}

export async function ensureSupabaseSchemaSql(): Promise<boolean> {
  const pool = getPgPool();
  if (!pool) return false;
  if (schemaBootstrapped) return true;
  const sql = readSchemaSql();
  if (!sql) return false;
  const client = await pool.connect();
  try {
    await client.query(sql);
    schemaBootstrapped = true;
    return true;
  } finally {
    client.release();
  }
}

function toIso(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

// ============================================================================
// LOAD FROM SUPABASE (POSTGRESQL SQL PRIMARY -> SUPABASE REST SECONDARY)
// ============================================================================
export async function loadDatabaseFromSupabase(): Promise<LmsDatabase | null> {
  const pool = getPgPool();
  if (pool) {
    try {
      await ensureSupabaseSchemaSql();
      const [
        usersRes,
        catsRes,
        coursesRes,
        modsRes,
        lessonsRes,
        enrRes,
        payRes,
        asgRes,
        subRes,
        quizRes,
        qaRes,
        certRes,
        notifRes,
        msgRes,
        annRes,
        webRes,
        setRes,
        otpRes,
        auditRes,
        metaRes,
      ] = await Promise.all([
        pool.query('select * from public.users'),
        pool.query('select * from public.categories order by order_index asc'),
        pool.query('select * from public.courses order by created_at desc'),
        pool.query('select * from public.modules order by order_index asc'),
        pool.query('select * from public.lessons order by order_index asc'),
        pool.query('select * from public.enrolments'),
        pool.query('select * from public.payments order by created_at desc'),
        pool.query('select * from public.assignments order by created_at desc'),
        pool.query('select * from public.assignment_submissions order by submitted_at desc'),
        pool.query('select * from public.quizzes order by created_at desc'),
        pool.query('select * from public.quiz_attempts order by attempted_at desc'),
        pool.query('select * from public.certificates order by issued_at desc'),
        pool.query('select * from public.notifications order by created_at desc'),
        pool.query('select * from public.support_messages order by created_at desc'),
        pool.query('select * from public.announcements order by created_at desc'),
        pool.query('select * from public.website_content where id = 1'),
        pool.query('select * from public.system_settings where id = 1'),
        pool.query('select * from public.otp_challenges'),
        pool.query('select * from public.security_audit_logs order by timestamp desc'),
        pool.query('select * from public.lms_state_meta where id = 1'),
      ]);

      if (usersRes.rows.length === 0) {
        return null; // Fresh database -> caller will seed initial Academy records into Supabase SQL
      }

      const db = mapRowsToDatabase({
        users: usersRes.rows,
        categories: catsRes.rows,
        courses: coursesRes.rows,
        modules: modsRes.rows,
        lessons: lessonsRes.rows,
        enrolments: enrRes.rows,
        payments: payRes.rows,
        assignments: asgRes.rows,
        submissions: subRes.rows,
        quizzes: quizRes.rows,
        quizAttempts: qaRes.rows,
        certificates: certRes.rows,
        notifications: notifRes.rows,
        messages: msgRes.rows,
        announcements: annRes.rows,
        website: webRes.rows[0],
        settings: setRes.rows[0],
        otpChallenges: otpRes.rows,
        securityLogs: auditRes.rows,
        meta: metaRes.rows[0],
      });
      lastSyncedAt = new Date().toISOString();
      lastSyncError = null;
      return db;
    } catch (err: any) {
      lastSyncError = err?.message || 'Unable to load from Supabase PostgreSQL';
      console.error('[Supabase PG Load Error]:', lastSyncError);
      return null;
    }
  }

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      const [
        usersRes,
        catsRes,
        coursesRes,
        modsRes,
        lessonsRes,
        enrRes,
        payRes,
        asgRes,
        subRes,
        quizRes,
        qaRes,
        certRes,
        notifRes,
        msgRes,
        annRes,
        webRes,
        setRes,
        otpRes,
        auditRes,
        metaRes,
      ] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('categories').select('*').order('order_index', { ascending: true }),
        supabase.from('courses').select('*'),
        supabase.from('modules').select('*').order('order_index', { ascending: true }),
        supabase.from('lessons').select('*').order('order_index', { ascending: true }),
        supabase.from('enrolments').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('assignments').select('*'),
        supabase.from('assignment_submissions').select('*'),
        supabase.from('quizzes').select('*'),
        supabase.from('quiz_attempts').select('*'),
        supabase.from('certificates').select('*'),
        supabase.from('notifications').select('*'),
        supabase.from('support_messages').select('*'),
        supabase.from('announcements').select('*'),
        supabase.from('website_content').select('*').eq('id', 1).maybeSingle(),
        supabase.from('system_settings').select('*').eq('id', 1).maybeSingle(),
        supabase.from('otp_challenges').select('*'),
        supabase.from('security_audit_logs').select('*').order('timestamp', { ascending: false }),
        supabase.from('lms_state_meta').select('*').eq('id', 1).maybeSingle(),
      ]);

      if (usersRes.error) throw new Error(usersRes.error.message);
      if (!usersRes.data || usersRes.data.length === 0) return null;

      const db = mapRowsToDatabase({
        users: usersRes.data,
        categories: catsRes.data || [],
        courses: coursesRes.data || [],
        modules: modsRes.data || [],
        lessons: lessonsRes.data || [],
        enrolments: enrRes.data || [],
        payments: payRes.data || [],
        assignments: asgRes.data || [],
        submissions: subRes.data || [],
        quizzes: quizRes.data || [],
        quizAttempts: qaRes.data || [],
        certificates: certRes.data || [],
        notifications: notifRes.data || [],
        messages: msgRes.data || [],
        announcements: annRes.data || [],
        website: webRes.data,
        settings: setRes.data,
        otpChallenges: otpRes.data || [],
        securityLogs: auditRes.data || [],
        meta: metaRes.data,
      });
      lastSyncedAt = new Date().toISOString();
      lastSyncError = null;
      return db;
    } catch (err: any) {
      lastSyncError = err?.message || 'Unable to load from Supabase REST';
      console.error('[Supabase REST Load Error]:', lastSyncError);
      return null;
    }
  }

  return null;
}

function mapRowsToDatabase(rows: {
  users: any[];
  categories: any[];
  courses: any[];
  modules: any[];
  lessons: any[];
  enrolments: any[];
  payments: any[];
  assignments: any[];
  submissions: any[];
  quizzes: any[];
  quizAttempts: any[];
  certificates: any[];
  notifications: any[];
  messages: any[];
  announcements: any[];
  website: any;
  settings: any;
  otpChallenges: any[];
  securityLogs: any[];
  meta: any;
}): LmsDatabase {
  const users: StoredUser[] = rows.users.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone || '',
    passwordHash: r.password_hash,
    role: r.role,
    avatarUrl: r.avatar_url || '',
    bio: r.bio || '',
    title: r.title || '',
    location: r.location || 'Accra, Ghana',
    status: r.status || 'ACTIVE',
    emailVerified: r.email_verified ?? true,
    twoFactorEnabled: r.two_factor_enabled ?? true,
    tokenVersion: Number(r.token_version ?? 1),
    failedLoginAttempts: Number(r.failed_login_attempts ?? 0),
    lockedUntil: r.locked_until !== null && r.locked_until !== undefined ? Number(r.locked_until) : undefined,
    lastLoginAt: r.last_login_at ? toIso(r.last_login_at) : undefined,
    createdAt: toIso(r.created_at),
  }));

  const categories: Category[] = rows.categories.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description || '',
    orderIndex: Number(r.order_index ?? 0),
  }));

  const courses: Course[] = rows.courses.map((r) => ({
    id: r.id,
    title: r.title,
    slug: r.slug,
    categoryId: r.category_id,
    instructorId: r.instructor_id,
    thumbnailUrl: r.thumbnail_url || '',
    summary: r.summary || '',
    description: r.description || '',
    priceGhs: Number(r.price_ghs ?? 0),
    isFree: Boolean(r.is_free),
    duration: r.duration || '4 Weeks',
    difficulty: r.difficulty || 'Beginner',
    isPublished: Boolean(r.is_published),
    isFeatured: Boolean(r.is_featured),
    driveFolderId: r.drive_folder_id || undefined,
    driveFolderName: r.drive_folder_name || undefined,
    learningObjectives: Array.isArray(r.learning_objectives) ? r.learning_objectives : [],
    requirements: Array.isArray(r.requirements) ? r.requirements : [],
    completionRequirement: r.completion_requirement || '',
    createdAt: toIso(r.created_at),
  }));

  const modules: Module[] = rows.modules.map((r) => ({
    id: r.id,
    courseId: r.course_id,
    title: r.title,
    description: r.description || '',
    orderIndex: Number(r.order_index ?? 1),
  }));

  const lessons: Lesson[] = rows.lessons.map((r) => ({
    id: r.id,
    moduleId: r.module_id,
    courseId: r.course_id,
    title: r.title,
    description: r.description || '',
    videoUrl: r.video_url || '',
    driveFileId: r.drive_file_id || undefined,
    durationMinutes: Number(r.duration_minutes ?? 15),
    pdfTitle: r.pdf_title || '',
    pdfSummary: r.pdf_summary || '',
    practicalExercise: r.practical_exercise || '',
    orderIndex: Number(r.order_index ?? 1),
    isFreePreview: Boolean(r.is_free_preview),
  }));

  const enrolments: Enrolment[] = rows.enrolments.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    courseId: r.course_id,
    status: r.status,
    progressPercent: Number(r.progress_percent ?? 0),
    completedLessonIds: Array.isArray(r.completed_lesson_ids) ? r.completed_lesson_ids : [],
    lastLessonId: r.last_lesson_id || undefined,
    driveAccessEmail: r.drive_access_email || undefined,
    driveAccessGrantedAt: r.drive_access_granted_at ? toIso(r.drive_access_granted_at) : undefined,
    enrolledAt: toIso(r.enrolled_at),
    completedAt: r.completed_at ? toIso(r.completed_at) : undefined,
  }));

  const payments: Payment[] = rows.payments.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    courseId: r.course_id,
    fullName: r.full_name,
    email: r.email,
    amountGhs: Number(r.amount_ghs ?? 0),
    senderPhone: r.sender_phone,
    transactionId: r.transaction_id,
    paymentMethod: r.payment_method || 'MANUAL_MOMO',
    gatewayReference: r.gateway_reference || undefined,
    gatewayChannel: r.gateway_channel || undefined,
    paymentDate: r.payment_date,
    screenshotDataUrl: r.screenshot_data_url || undefined,
    status: r.status,
    adminNote: r.admin_note || undefined,
    studentReply: r.student_reply || undefined,
    reviewedBy: r.reviewed_by || undefined,
    reviewedAt: r.reviewed_at ? toIso(r.reviewed_at) : undefined,
    createdAt: toIso(r.created_at),
  }));

  const assignments: Assignment[] = rows.assignments.map((r) => ({
    id: r.id,
    courseId: r.course_id,
    title: r.title,
    instructions: r.instructions,
    dueDate: r.due_date,
    maxScore: Number(r.max_score ?? 100),
    createdAt: toIso(r.created_at),
  }));

  const submissions: AssignmentSubmission[] = rows.submissions.map((r) => ({
    id: r.id,
    assignmentId: r.assignment_id,
    courseId: r.course_id,
    studentId: r.student_id,
    submissionText: r.submission_text,
    projectUrl: r.project_url || undefined,
    status: r.status,
    score: r.score !== null && r.score !== undefined ? Number(r.score) : undefined,
    feedback: r.feedback || undefined,
    submittedAt: toIso(r.submitted_at),
    gradedAt: r.graded_at ? toIso(r.graded_at) : undefined,
  }));

  const quizzes: Quiz[] = rows.quizzes.map((r) => ({
    id: r.id,
    courseId: r.course_id,
    title: r.title,
    description: r.description || '',
    passingScore: Number(r.passing_score ?? 70),
    questions: Array.isArray(r.questions) ? r.questions : [],
    createdAt: toIso(r.created_at),
  }));

  const quizAttempts: QuizAttempt[] = rows.quizAttempts.map((r) => ({
    id: r.id,
    quizId: r.quiz_id,
    courseId: r.course_id,
    studentId: r.student_id,
    answers: Array.isArray(r.answers) ? r.answers : [],
    scorePercent: Number(r.score_percent ?? 0),
    passed: Boolean(r.passed),
    attemptedAt: toIso(r.attempted_at),
  }));

  const certificates: Certificate[] = rows.certificates.map((r) => ({
    id: r.id,
    certificateNumber: r.certificate_number,
    studentId: r.student_id,
    courseId: r.course_id,
    studentName: r.student_name,
    courseTitle: r.course_title,
    instructorName: r.instructor_name,
    issuedAt: toIso(r.issued_at),
  }));

  const notifications: NotificationItem[] = rows.notifications.map((r) => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    message: r.message,
    type: r.type,
    isRead: Boolean(r.is_read),
    createdAt: toIso(r.created_at),
  }));

  const messages: SupportMessage[] = rows.messages.map((r) => ({
    id: r.id,
    senderId: r.sender_id || undefined,
    senderName: r.sender_name,
    senderEmail: r.sender_email,
    recipientRole: r.recipient_role,
    recipientId: r.recipient_id || undefined,
    courseId: r.course_id || undefined,
    subject: r.subject,
    body: r.body,
    replyBody: r.reply_body || undefined,
    status: r.status,
    createdAt: toIso(r.created_at),
    repliedAt: r.replied_at ? toIso(r.replied_at) : undefined,
  }));

  const announcements: Announcement[] = rows.announcements.map((r) => ({
    id: r.id,
    title: r.title,
    message: r.message,
    audience: r.audience,
    authorId: r.author_id || '',
    createdAt: toIso(r.created_at),
  }));

  const w = rows.website || {};
  const website: WebsiteContent = {
    heroHeadline: w.hero_headline || 'Master the Future with Artificial Intelligence.',
    heroSubheadline: w.hero_subheadline || '',
    aboutTitle: w.about_title || '',
    aboutMission: w.about_mission || '',
    aboutVision: w.about_vision || '',
    announcementBanner: w.announcement_banner || '',
    testimonials: Array.isArray(w.testimonials) ? w.testimonials : [],
    faqs: Array.isArray(w.faqs) ? w.faqs : [],
  };

  const s = rows.settings || {};
  const settings: SystemSettings = {
    academyName: s.academy_name || 'EK TECH SOLUTIONS',
    tagline: s.tagline || 'Learn Technology. Build with AI. Create the Future.',
    momoBusinessName: s.momo_business_name || 'EK TECH SOLUTIONS',
    momoNumber: s.momo_number || '0257460536',
    whatsappNumber: s.whatsapp_number || '0551464715',
    supportEmail: s.support_email || 'admissions@ektechsolutions.com',
    currency: s.currency || 'GH₵',
    allowPublicRegistration: s.allow_public_registration ?? true,
    paymentGatewayMode: s.payment_gateway_mode || 'MANUAL_MOMO',
  };

  const otpChallenges: OtpChallengeRecord[] = rows.otpChallenges.map((r) => ({
    id: r.id,
    email: r.email,
    userId: r.user_id || undefined,
    purpose: r.purpose,
    otpHash: r.otp_hash,
    otpSalt: r.otp_salt,
    attempts: Number(r.attempts ?? 0),
    maxAttempts: Number(r.max_attempts ?? 5),
    expiresAt: Number(r.expires_at),
    lastSentAt: Number(r.last_sent_at),
    createdAt: toIso(r.created_at),
    pendingUserPayload: r.pending_user_payload || undefined,
  }));

  const securityLogs: SecurityAuditEntry[] = rows.securityLogs.map((r) => ({
    id: r.id,
    timestamp: toIso(r.timestamp),
    event: r.event,
    severity: r.severity,
    actorEmail: r.actor_email,
    actorRole: r.actor_role,
    ipAddress: r.ip_address,
    details: r.details,
    previousHash: r.previous_hash,
    entryHash: r.entry_hash,
  }));

  return {
    schemaVersion: Number(rows.meta?.schema_version ?? 3),
    users,
    categories,
    courses,
    modules,
    lessons,
    enrolments,
    payments,
    assignments,
    submissions,
    quizzes,
    quizAttempts,
    certificates,
    notifications,
    messages,
    announcements,
    website,
    settings,
    otpChallenges,
    securityLogs,
    integrityChecksum: rows.meta?.integrity_checksum || undefined,
  };
}

// ============================================================================
// SYNC SNAPSHOT TO SUPABASE (TRANSACTIONAL SQL OR SUPABASE SERVICE CLIENT)
// ============================================================================
export async function syncDatabaseToSupabase(db: LmsDatabase): Promise<{ ok: boolean; syncedCount: number }> {
  const pool = getPgPool();
  if (pool) {
    await ensureSupabaseSchemaSql();
    const client = await pool.connect();
    let count = 0;
    try {
      await client.query('BEGIN');

      for (const u of db.users) {
        await client.query(
          `insert into public.users (id, full_name, email, phone, password_hash, role, avatar_url, bio, title, location, status, email_verified, two_factor_enabled, token_version, failed_login_attempts, locked_until, last_login_at, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
           on conflict (id) do update set
             full_name=excluded.full_name, email=excluded.email, phone=excluded.phone, password_hash=excluded.password_hash,
             role=excluded.role, avatar_url=excluded.avatar_url, bio=excluded.bio, title=excluded.title, location=excluded.location,
             status=excluded.status, email_verified=excluded.email_verified, two_factor_enabled=excluded.two_factor_enabled,
             token_version=excluded.token_version, failed_login_attempts=excluded.failed_login_attempts,
             locked_until=excluded.locked_until, last_login_at=excluded.last_login_at`,
          [
            u.id, u.fullName, u.email, u.phone, u.passwordHash, u.role, u.avatarUrl, u.bio, u.title, u.location,
            u.status, u.emailVerified ?? true, u.twoFactorEnabled ?? true, u.tokenVersion ?? 1,
            u.failedLoginAttempts ?? 0, u.lockedUntil ?? null, u.lastLoginAt ?? null, u.createdAt,
          ]
        );
        count++;
      }

      for (const c of db.categories) {
        await client.query(
          `insert into public.categories (id, name, slug, description, order_index)
           values ($1,$2,$3,$4,$5)
           on conflict (id) do update set name=excluded.name, slug=excluded.slug, description=excluded.description, order_index=excluded.order_index`,
          [c.id, c.name, c.slug, c.description, c.orderIndex]
        );
        count++;
      }

      for (const crs of db.courses) {
        await client.query(
          `insert into public.courses (id, title, slug, category_id, instructor_id, thumbnail_url, summary, description, price_ghs, is_free, duration, difficulty, is_published, is_featured, drive_folder_id, drive_folder_name, learning_objectives, requirements, completion_requirement, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18::jsonb,$19,$20)
           on conflict (id) do update set
             title=excluded.title, slug=excluded.slug, category_id=excluded.category_id, instructor_id=excluded.instructor_id,
             thumbnail_url=excluded.thumbnail_url, summary=excluded.summary, description=excluded.description,
             price_ghs=excluded.price_ghs, is_free=excluded.is_free, duration=excluded.duration, difficulty=excluded.difficulty,
             is_published=excluded.is_published, is_featured=excluded.is_featured, drive_folder_id=excluded.drive_folder_id,
             drive_folder_name=excluded.drive_folder_name, learning_objectives=excluded.learning_objectives,
             requirements=excluded.requirements, completion_requirement=excluded.completion_requirement`,
          [
            crs.id, crs.title, crs.slug, crs.categoryId, crs.instructorId, crs.thumbnailUrl, crs.summary, crs.description,
            crs.priceGhs, crs.isFree, crs.duration, crs.difficulty, crs.isPublished, crs.isFeatured,
            crs.driveFolderId ?? null, crs.driveFolderName ?? null,
            JSON.stringify(crs.learningObjectives || []), JSON.stringify(crs.requirements || []),
            crs.completionRequirement, crs.createdAt,
          ]
        );
        count++;
      }

      for (const m of db.modules) {
        await client.query(
          `insert into public.modules (id, course_id, title, description, order_index)
           values ($1,$2,$3,$4,$5)
           on conflict (id) do update set course_id=excluded.course_id, title=excluded.title, description=excluded.description, order_index=excluded.order_index`,
          [m.id, m.courseId, m.title, m.description, m.orderIndex]
        );
        count++;
      }

      for (const l of db.lessons) {
        await client.query(
          `insert into public.lessons (id, module_id, course_id, title, description, video_url, drive_file_id, duration_minutes, pdf_title, pdf_summary, practical_exercise, order_index, is_free_preview)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           on conflict (id) do update set
             module_id=excluded.module_id, course_id=excluded.course_id, title=excluded.title, description=excluded.description,
             video_url=excluded.video_url, drive_file_id=excluded.drive_file_id, duration_minutes=excluded.duration_minutes,
             pdf_title=excluded.pdf_title, pdf_summary=excluded.pdf_summary, practical_exercise=excluded.practical_exercise,
             order_index=excluded.order_index, is_free_preview=excluded.is_free_preview`,
          [
            l.id, l.moduleId, l.courseId, l.title, l.description, l.videoUrl, l.driveFileId ?? null,
            l.durationMinutes, l.pdfTitle, l.pdfSummary, l.practicalExercise, l.orderIndex, l.isFreePreview,
          ]
        );
        count++;
      }

      for (const e of db.enrolments) {
        await client.query(
          `insert into public.enrolments (id, student_id, course_id, status, progress_percent, completed_lesson_ids, last_lesson_id, drive_access_email, drive_access_granted_at, enrolled_at, completed_at)
           values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11)
           on conflict (id) do update set
             status=excluded.status, progress_percent=excluded.progress_percent, completed_lesson_ids=excluded.completed_lesson_ids,
             last_lesson_id=excluded.last_lesson_id, drive_access_email=excluded.drive_access_email,
             drive_access_granted_at=excluded.drive_access_granted_at, completed_at=excluded.completed_at`,
          [
            e.id, e.studentId, e.courseId, e.status, e.progressPercent, JSON.stringify(e.completedLessonIds || []),
            e.lastLessonId ?? null, e.driveAccessEmail ?? null, e.driveAccessGrantedAt ?? null, e.enrolledAt, e.completedAt ?? null,
          ]
        );
        count++;
      }

      await client.query(`alter table public.payments add column if not exists payment_method text not null default 'MANUAL_MOMO'`);
      await client.query(`alter table public.payments add column if not exists gateway_reference text`);
      await client.query(`alter table public.payments add column if not exists gateway_channel text`);

      for (const p of db.payments) {
        await client.query(
          `insert into public.payments (id, student_id, course_id, full_name, email, amount_ghs, sender_phone, transaction_id, payment_method, gateway_reference, gateway_channel, payment_date, screenshot_data_url, status, admin_note, student_reply, reviewed_by, reviewed_at, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
           on conflict (id) do update set
             status=excluded.status, payment_method=excluded.payment_method, gateway_reference=excluded.gateway_reference,
             gateway_channel=excluded.gateway_channel, admin_note=excluded.admin_note, student_reply=excluded.student_reply,
             screenshot_data_url=excluded.screenshot_data_url, reviewed_by=excluded.reviewed_by, reviewed_at=excluded.reviewed_at`,
          [
            p.id, p.studentId, p.courseId, p.fullName, p.email, p.amountGhs, p.senderPhone, p.transactionId,
            p.paymentMethod ?? 'MANUAL_MOMO', p.gatewayReference ?? null, p.gatewayChannel ?? null,
            p.paymentDate, p.screenshotDataUrl ?? null, p.status, p.adminNote ?? null, p.studentReply ?? null,
            p.reviewedBy ?? null, p.reviewedAt ?? null, p.createdAt,
          ]
        );
        count++;
      }

      for (const a of db.assignments) {
        await client.query(
          `insert into public.assignments (id, course_id, title, instructions, due_date, max_score, created_at)
           values ($1,$2,$3,$4,$5,$6,$7)
           on conflict (id) do update set title=excluded.title, instructions=excluded.instructions, due_date=excluded.due_date, max_score=excluded.max_score`,
          [a.id, a.courseId, a.title, a.instructions, a.dueDate, a.maxScore, a.createdAt]
        );
        count++;
      }

      for (const s of db.submissions) {
        await client.query(
          `insert into public.assignment_submissions (id, assignment_id, course_id, student_id, submission_text, project_url, status, score, feedback, submitted_at, graded_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           on conflict (id) do update set
             submission_text=excluded.submission_text, project_url=excluded.project_url, status=excluded.status,
             score=excluded.score, feedback=excluded.feedback, submitted_at=excluded.submitted_at, graded_at=excluded.graded_at`,
          [
            s.id, s.assignmentId, s.courseId, s.studentId, s.submissionText, s.projectUrl ?? null, s.status,
            s.score ?? null, s.feedback ?? null, s.submittedAt, s.gradedAt ?? null,
          ]
        );
        count++;
      }

      for (const q of db.quizzes) {
        await client.query(
          `insert into public.quizzes (id, course_id, title, description, passing_score, questions, created_at)
           values ($1,$2,$3,$4,$5,$6::jsonb,$7)
           on conflict (id) do update set title=excluded.title, description=excluded.description, passing_score=excluded.passing_score, questions=excluded.questions`,
          [q.id, q.courseId, q.title, q.description, q.passingScore, JSON.stringify(q.questions || []), q.createdAt]
        );
        count++;
      }

      for (const qa of db.quizAttempts) {
        await client.query(
          `insert into public.quiz_attempts (id, quiz_id, course_id, student_id, answers, score_percent, passed, attempted_at)
           values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)
           on conflict (id) do nothing`,
          [qa.id, qa.quizId, qa.courseId, qa.studentId, JSON.stringify(qa.answers || []), qa.scorePercent, qa.passed, qa.attemptedAt]
        );
        count++;
      }

      for (const c of db.certificates) {
        await client.query(
          `insert into public.certificates (id, certificate_number, student_id, course_id, student_name, course_title, instructor_name, issued_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8)
           on conflict (id) do nothing`,
          [c.id, c.certificateNumber, c.studentId, c.courseId, c.studentName, c.courseTitle, c.instructorName, c.issuedAt]
        );
        count++;
      }

      for (const n of db.notifications) {
        await client.query(
          `insert into public.notifications (id, user_id, title, message, type, is_read, created_at)
           values ($1,$2,$3,$4,$5,$6,$7)
           on conflict (id) do update set is_read=excluded.is_read`,
          [n.id, n.userId, n.title, n.message, n.type, n.isRead, n.createdAt]
        );
        count++;
      }

      for (const m of db.messages) {
        await client.query(
          `insert into public.support_messages (id, sender_id, sender_name, sender_email, recipient_role, recipient_id, course_id, subject, body, reply_body, status, created_at, replied_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           on conflict (id) do update set reply_body=excluded.reply_body, status=excluded.status, replied_at=excluded.replied_at`,
          [
            m.id, m.senderId ?? null, m.senderName, m.senderEmail, m.recipientRole, m.recipientId ?? null,
            m.courseId ?? null, m.subject, m.body, m.replyBody ?? null, m.status, m.createdAt, m.repliedAt ?? null,
          ]
        );
        count++;
      }

      for (const a of db.announcements) {
        await client.query(
          `insert into public.announcements (id, title, message, audience, author_id, created_at)
           values ($1,$2,$3,$4,$5,$6)
           on conflict (id) do update set title=excluded.title, message=excluded.message, audience=excluded.audience`,
          [a.id, a.title, a.message, a.audience, a.authorId || null, a.createdAt]
        );
        count++;
      }

      await client.query(
        `insert into public.website_content (id, hero_headline, hero_subheadline, about_title, about_mission, about_vision, announcement_banner, testimonials, faqs, updated_at)
         values (1,$1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,now())
         on conflict (id) do update set
           hero_headline=excluded.hero_headline, hero_subheadline=excluded.hero_subheadline, about_title=excluded.about_title,
           about_mission=excluded.about_mission, about_vision=excluded.about_vision, announcement_banner=excluded.announcement_banner,
           testimonials=excluded.testimonials, faqs=excluded.faqs, updated_at=now()`,
        [
          db.website.heroHeadline, db.website.heroSubheadline, db.website.aboutTitle,
          db.website.aboutMission, db.website.aboutVision, db.website.announcementBanner,
          JSON.stringify(db.website.testimonials || []), JSON.stringify(db.website.faqs || []),
        ]
      );

      await client.query(
        `insert into public.system_settings (id, academy_name, tagline, momo_business_name, momo_number, whatsapp_number, support_email, currency, allow_public_registration, payment_gateway_mode)
         values (1,$1,$2,$3,$4,$5,$6,$7,$8,$9)
         on conflict (id) do update set
           academy_name=excluded.academy_name, tagline=excluded.tagline, momo_business_name=excluded.momo_business_name,
           momo_number=excluded.momo_number, whatsapp_number=excluded.whatsapp_number, support_email=excluded.support_email,
           currency=excluded.currency, allow_public_registration=excluded.allow_public_registration,
           payment_gateway_mode=excluded.payment_gateway_mode`,
        [
          db.settings.academyName, db.settings.tagline, db.settings.momoBusinessName, db.settings.momoNumber,
          db.settings.whatsappNumber, db.settings.supportEmail, db.settings.currency,
          db.settings.allowPublicRegistration, db.settings.paymentGatewayMode,
        ]
      );

      // Reconcile deletions for ephemeral OTP challenges + curriculum deletions
      const activeOtpIds = (db.otpChallenges || []).map((c) => c.id);
      if (activeOtpIds.length > 0) {
        await client.query('delete from public.otp_challenges where not (id = any($1::text[]))', [activeOtpIds]);
      } else {
        await client.query('delete from public.otp_challenges');
      }
      for (const o of db.otpChallenges || []) {
        await client.query(
          `insert into public.otp_challenges (id, email, user_id, purpose, otp_hash, otp_salt, attempts, max_attempts, expires_at, last_sent_at, pending_user_payload, created_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12)
           on conflict (id) do update set
             otp_hash=excluded.otp_hash, otp_salt=excluded.otp_salt, attempts=excluded.attempts,
             expires_at=excluded.expires_at, last_sent_at=excluded.last_sent_at`,
          [
            o.id, o.email, o.userId ?? null, o.purpose, o.otpHash, o.otpSalt, o.attempts, o.maxAttempts,
            o.expiresAt, o.lastSentAt, o.pendingUserPayload ? JSON.stringify(o.pendingUserPayload) : null, o.createdAt,
          ]
        );
      }

      for (const log of db.securityLogs || []) {
        await client.query(
          `insert into public.security_audit_logs (id, timestamp, event, severity, actor_email, actor_role, ip_address, details, previous_hash, entry_hash)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           on conflict (id) do nothing`,
          [
            log.id, log.timestamp, log.event, log.severity, log.actorEmail,
            log.actorRole || 'ANONYMOUS', log.ipAddress, log.details, log.previousHash, log.entryHash,
          ]
        );
      }

      // Sync deleted categories, courses, modules, lessons cleanly
      const catIds = db.categories.map((c) => c.id);
      if (catIds.length) await client.query('delete from public.categories where not (id = any($1::text[]))', [catIds]);
      const crsIds = db.courses.map((c) => c.id);
      if (crsIds.length) await client.query('delete from public.courses where not (id = any($1::text[]))', [crsIds]);
      const modIds = db.modules.map((m) => m.id);
      if (modIds.length) await client.query('delete from public.modules where not (id = any($1::text[]))', [modIds]);
      const lesIds = db.lessons.map((l) => l.id);
      if (lesIds.length) await client.query('delete from public.lessons where not (id = any($1::text[]))', [lesIds]);

      await client.query(
        `insert into public.lms_state_meta (id, schema_version, integrity_checksum, updated_at)
         values (1, $1, $2, now())
         on conflict (id) do update set schema_version=excluded.schema_version, integrity_checksum=excluded.integrity_checksum, updated_at=now()`,
        [db.schemaVersion, db.integrityChecksum || null]
      );

      await client.query('COMMIT');
      lastSyncedAt = new Date().toISOString();
      lastSyncError = null;
      return { ok: true, syncedCount: count };
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => undefined);
      lastSyncError = err?.message || 'Supabase SQL transaction failed';
      throw err;
    } finally {
      client.release();
    }
  }

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    let count = 0;
    const isServiceRole = Boolean(getSupabaseServiceKey());
    const upsertTable = async (table: string, rows: any[]) => {
      if (!rows.length) return;
      const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
      if (error) {
        if (error.code === '42501' || error.message?.includes('row-level security')) {
          throw new Error(
            `Supabase RLS active: Table "${table}" restricts writes with Anon Key. To sync full database records, configure SUPABASE_SERVICE_ROLE_KEY or DATABASE_URL in server environment secrets, or grant INSERT/UPDATE policies in Supabase SQL editor.`
          );
        }
        throw new Error(`${table}: ${error.message}`);
      }
      count += rows.length;
    };

    try {
      await upsertTable(
        'users',
        db.users.map((u) => ({
          id: u.id, full_name: u.fullName, email: u.email, phone: u.phone, password_hash: u.passwordHash,
          role: u.role, avatar_url: u.avatarUrl, bio: u.bio, title: u.title, location: u.location,
          status: u.status, email_verified: u.emailVerified ?? true, two_factor_enabled: u.twoFactorEnabled ?? true,
          token_version: u.tokenVersion ?? 1, failed_login_attempts: u.failedLoginAttempts ?? 0,
          locked_until: u.lockedUntil ?? null, last_login_at: u.lastLoginAt ?? null, created_at: u.createdAt,
        }))
      );
      await upsertTable(
        'categories',
        db.categories.map((c) => ({
          id: c.id, name: c.name, slug: c.slug, description: c.description, order_index: c.orderIndex,
        }))
      );
      await upsertTable(
        'courses',
        db.courses.map((c) => ({
          id: c.id, title: c.title, slug: c.slug, category_id: c.categoryId, instructor_id: c.instructorId,
          thumbnail_url: c.thumbnailUrl, summary: c.summary, description: c.description, price_ghs: c.priceGhs,
          is_free: c.isFree, duration: c.duration, difficulty: c.difficulty, is_published: c.isPublished,
          is_featured: c.isFeatured, drive_folder_id: c.driveFolderId ?? null, drive_folder_name: c.driveFolderName ?? null,
          learning_objectives: c.learningObjectives, requirements: c.requirements,
          completion_requirement: c.completionRequirement, created_at: c.createdAt,
        }))
      );
      await upsertTable(
        'modules',
        db.modules.map((m) => ({
          id: m.id, course_id: m.courseId, title: m.title, description: m.description, order_index: m.orderIndex,
        }))
      );
      await upsertTable(
        'lessons',
        db.lessons.map((l) => ({
          id: l.id, module_id: l.moduleId, course_id: l.courseId, title: l.title, description: l.description,
          video_url: l.videoUrl, drive_file_id: l.driveFileId ?? null, duration_minutes: l.durationMinutes,
          pdf_title: l.pdfTitle, pdf_summary: l.pdfSummary, practical_exercise: l.practicalExercise,
          order_index: l.orderIndex, is_free_preview: l.isFreePreview,
        }))
      );
      await upsertTable(
        'enrolments',
        db.enrolments.map((e) => ({
          id: e.id, student_id: e.studentId, course_id: e.courseId, status: e.status,
          progress_percent: e.progressPercent, completed_lesson_ids: e.completedLessonIds,
          last_lesson_id: e.lastLessonId ?? null, drive_access_email: e.driveAccessEmail ?? null,
          drive_access_granted_at: e.driveAccessGrantedAt ?? null, enrolled_at: e.enrolledAt,
          completed_at: e.completedAt ?? null,
        }))
      );
      try {
        await upsertTable(
          'payments',
          db.payments.map((p) => ({
            id: p.id, student_id: p.studentId, course_id: p.courseId, full_name: p.fullName, email: p.email,
            amount_ghs: p.amountGhs, sender_phone: p.senderPhone, transaction_id: p.transactionId,
            payment_method: p.paymentMethod ?? 'MANUAL_MOMO', gateway_reference: p.gatewayReference ?? null,
            gateway_channel: p.gatewayChannel ?? null, payment_date: p.paymentDate,
            screenshot_data_url: p.screenshotDataUrl ?? null, status: p.status,
            admin_note: p.adminNote ?? null, student_reply: p.studentReply ?? null,
            reviewed_by: p.reviewedBy ?? null, reviewed_at: p.reviewedAt ?? null, created_at: p.createdAt,
          }))
        );
      } catch (paySyncErr: any) {
        if (String(paySyncErr?.message || '').includes('column')) {
          await upsertTable(
            'payments',
            db.payments.map((p) => ({
              id: p.id, student_id: p.studentId, course_id: p.courseId, full_name: p.fullName, email: p.email,
              amount_ghs: p.amountGhs, sender_phone: p.senderPhone, transaction_id: p.transactionId,
              payment_date: p.paymentDate, screenshot_data_url: p.screenshotDataUrl ?? null, status: p.status,
              admin_note: p.adminNote ?? null, student_reply: p.studentReply ?? null,
              reviewed_by: p.reviewedBy ?? null, reviewed_at: p.reviewedAt ?? null, created_at: p.createdAt,
            }))
          );
        } else {
          throw paySyncErr;
        }
      }
      await upsertTable(
        'assignments',
        db.assignments.map((a) => ({
          id: a.id, course_id: a.courseId, title: a.title, instructions: a.instructions,
          due_date: a.dueDate, max_score: a.maxScore, created_at: a.createdAt,
        }))
      );
      await upsertTable(
        'assignment_submissions',
        db.submissions.map((s) => ({
          id: s.id, assignment_id: s.assignmentId, course_id: s.courseId, student_id: s.studentId,
          submission_text: s.submissionText, project_url: s.projectUrl ?? null, status: s.status,
          score: s.score ?? null, feedback: s.feedback ?? null, submitted_at: s.submittedAt,
          graded_at: s.gradedAt ?? null,
        }))
      );
      await upsertTable(
        'quizzes',
        db.quizzes.map((q) => ({
          id: q.id, course_id: q.courseId, title: q.title, description: q.description,
          passing_score: q.passingScore, questions: q.questions, created_at: q.createdAt,
        }))
      );
      await upsertTable(
        'quiz_attempts',
        db.quizAttempts.map((qa) => ({
          id: qa.id, quiz_id: qa.quizId, course_id: qa.courseId, student_id: qa.studentId,
          answers: qa.answers, score_percent: qa.scorePercent, passed: qa.passed, attempted_at: qa.attemptedAt,
        }))
      );
      await upsertTable(
        'certificates',
        db.certificates.map((c) => ({
          id: c.id, certificate_number: c.certificateNumber, student_id: c.studentId, course_id: c.courseId,
          student_name: c.studentName, course_title: c.courseTitle, instructor_name: c.instructorName,
          issued_at: c.issuedAt,
        }))
      );
      await upsertTable(
        'notifications',
        db.notifications.map((n) => ({
          id: n.id, user_id: n.userId, title: n.title, message: n.message, type: n.type,
          is_read: n.isRead, created_at: n.createdAt,
        }))
      );
      await upsertTable(
        'support_messages',
        db.messages.map((m) => ({
          id: m.id, sender_id: m.senderId ?? null, sender_name: m.senderName, sender_email: m.senderEmail,
          recipient_role: m.recipientRole, recipient_id: m.recipientId ?? null, course_id: m.courseId ?? null,
          subject: m.subject, body: m.body, reply_body: m.replyBody ?? null, status: m.status,
          created_at: m.createdAt, replied_at: m.repliedAt ?? null,
        }))
      );
      await upsertTable(
        'announcements',
        db.announcements.map((a) => ({
          id: a.id, title: a.title, message: a.message, audience: a.audience,
          author_id: a.authorId || null, created_at: a.createdAt,
        }))
      );
      await upsertTable('website_content', [
        {
          id: 1,
          hero_headline: db.website.heroHeadline,
          hero_subheadline: db.website.heroSubheadline,
          about_title: db.website.aboutTitle,
          about_mission: db.website.aboutMission,
          about_vision: db.website.aboutVision,
          announcement_banner: db.website.announcementBanner,
          testimonials: db.website.testimonials,
          faqs: db.website.faqs,
          updated_at: new Date().toISOString(),
        },
      ]);
      await upsertTable('system_settings', [
        {
          id: 1,
          academy_name: db.settings.academyName,
          tagline: db.settings.tagline,
          momo_business_name: db.settings.momoBusinessName,
          momo_number: db.settings.momoNumber,
          whatsapp_number: db.settings.whatsappNumber,
          support_email: db.settings.supportEmail,
          currency: db.settings.currency,
          allow_public_registration: db.settings.allowPublicRegistration,
          payment_gateway_mode: db.settings.paymentGatewayMode,
        },
      ]);
      await upsertTable(
        'otp_challenges',
        (db.otpChallenges || []).map((o) => ({
          id: o.id, email: o.email, user_id: o.userId ?? null, purpose: o.purpose,
          otp_hash: o.otpHash, otp_salt: o.otpSalt, attempts: o.attempts, max_attempts: o.maxAttempts,
          expires_at: o.expiresAt, last_sent_at: o.lastSentAt,
          pending_user_payload: o.pendingUserPayload ?? null, created_at: o.createdAt,
        }))
      );
      await upsertTable(
        'security_audit_logs',
        (db.securityLogs || []).map((log) => ({
          id: log.id, timestamp: log.timestamp, event: log.event, severity: log.severity,
          actor_email: log.actorEmail, actor_role: log.actorRole || 'ANONYMOUS',
          ip_address: log.ipAddress, details: log.details, previous_hash: log.previousHash, entry_hash: log.entryHash,
        }))
      );
      await upsertTable('lms_state_meta', [
        {
          id: 1,
          schema_version: db.schemaVersion,
          integrity_checksum: db.integrityChecksum ?? null,
          updated_at: new Date().toISOString(),
        },
      ]);

      lastSyncedAt = new Date().toISOString();
      lastSyncError = null;
      return { ok: true, syncedCount: count };
    } catch (err: any) {
      lastSyncError = err?.message || 'Supabase REST sync failed';
      throw err;
    }
  }

  return { ok: false, syncedCount: 0 };
}

export async function testSupabaseConnection(): Promise<SupabaseTestResult> {
  const started = Date.now();
  const pool = getPgPool();
  if (pool) {
    try {
      await ensureSupabaseSchemaSql();
      const [infoRes, tablesRes] = await Promise.all([
        pool.query('select current_database() as db_name, version() as pg_version, now() as server_time'),
        pool.query(
          "select count(*)::int as cnt from information_schema.tables where table_schema = 'public'"
        ),
      ]);
      const row = infoRes.rows[0];
      lastSyncError = null;
      return {
        connected: true,
        driver: 'SUPABASE_POSTGRES_SQL',
        latencyMs: Date.now() - started,
        databaseName: row.db_name,
        postgresVersion: String(row.pg_version || '').split(' ').slice(0, 2).join(' '),
        tablesCount: Number(tablesRes.rows[0]?.cnt ?? 0),
        message: 'Connected to Supabase PostgreSQL SQL database with RLS and CIA schema active.',
      };
    } catch (err: any) {
      const msg = err?.message || 'PostgreSQL connection failed';
      lastSyncError = msg;
      return {
        connected: false,
        driver: 'SUPABASE_POSTGRES_SQL',
        latencyMs: Date.now() - started,
        error: msg,
        message: 'Could not reach Supabase PostgreSQL SQL server. Check DATABASE_URL secret.',
      };
    }
  }

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const isService = Boolean(getSupabaseServiceKey());
    try {
      const [settingsRes, coursesRes, catsRes] = await Promise.all([
        supabase.from('system_settings').select('id').limit(1),
        supabase.from('courses').select('id, title, slug').limit(3),
        supabase.from('categories').select('id, name, slug').limit(3),
      ]);

      if (settingsRes.error && coursesRes.error && catsRes.error) {
        return {
          connected: false,
          driver: 'SUPABASE_REST_API',
          latencyMs: Date.now() - started,
          error: settingsRes.error?.message || coursesRes.error?.message || 'Tables not accessible',
          message:
            'Supabase API reachable, but tables are not initialized yet. Run supabase/schema.sql in your Supabase SQL Editor.',
        };
      }
      lastSyncError = null;
      return {
        connected: true,
        driver: 'SUPABASE_REST_API',
        latencyMs: Date.now() - started,
        message: isService
          ? `Connected to Supabase REST API (${getSupabaseProjectRef()}) with full service role key.`
          : `Connected to Supabase REST API (${getSupabaseProjectRef()}) with verified Anon Key. Public catalog and system tables verified.`,
      };
    } catch (err: any) {
      return {
        connected: false,
        driver: 'SUPABASE_REST_API',
        latencyMs: Date.now() - started,
        error: err?.message || 'Supabase API check failed',
        message: 'Supabase REST connection failed.',
      };
    }
  }

  return {
    connected: false,
    driver: 'LOCAL_JSON_FALLBACK',
    latencyMs: Date.now() - started,
    message:
      'Supabase credentials not set in environment secrets yet (DATABASE_URL / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). Using local encrypted/checksummed persistent storage until connected.',
  };
}

export function getSupabaseStatus(): SupabaseConnectionStatus {
  const hasDbUrl = hasPostgresConnection();
  const hasRest = hasSupabaseRestConnection();
  const projectUrl = getSupabaseUrl();
  return {
    configured: hasDbUrl || hasRest,
    driver: hasDbUrl
      ? 'SUPABASE_POSTGRES_SQL'
      : hasRest
      ? 'SUPABASE_REST_API'
      : 'LOCAL_JSON_FALLBACK',
    projectRef: getSupabaseProjectRef(),
    projectUrl,
    hasDatabaseUrl: hasDbUrl,
    hasSupabaseUrl: Boolean(projectUrl),
    hasServiceRoleKey: Boolean(getSupabaseServiceKey()),
    hasAnonKey: Boolean(getSupabaseAnonKey()),
    lastSyncedAt,
    lastSyncError,
  };
}
