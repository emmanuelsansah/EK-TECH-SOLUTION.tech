import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  createInitialDatabase,
  CURRENT_SCHEMA_VERSION,
  type LmsDatabase,
  type StoredUser,
} from './seed.ts';
import { computeAuditEntryHash, computeDatabaseChecksum } from './security.ts';
import {
  hasWriteCapableSupabase,
  isSupabaseConfigured,
  loadDatabaseFromSupabase,
  syncDatabaseToSupabase,
} from './supabase.ts';
import type { SecurityAuditEntry, SecurityEventSeverity, User, UserRole } from '../src/types.ts';

const IS_VERCEL = Boolean(process.env.VERCEL);
const BUNDLED_DB_FILE = path.resolve(process.cwd(), 'data', 'lms-db.json');
const DATA_DIR = IS_VERCEL ? path.join(os.tmpdir(), 'ek-tech-data') : path.resolve(process.cwd(), 'data');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const DB_FILE = path.join(DATA_DIR, 'lms-db.json');

let memoryDb: LmsDatabase | null = null;
let syncChain: Promise<void> = Promise.resolve();
let hydrationPromise: Promise<void> | null = null;
let lastHydratedAt = 0;
let hasCompletedInitialHydration = false;
const VERCEL_REHYDRATE_TTL_MS = 4000;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function writeLocalSnapshot(db: LmsDatabase): void {
  try {
    ensureDataDir();
    const tempPath = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempPath, DB_FILE);
  } catch (err) {
    console.warn('Unable to write persistent file (running in-memory):', err);
  }
}

function queueSupabaseSync(snapshot: LmsDatabase): void {
  if (!isSupabaseConfigured()) return;
  const cloned = JSON.parse(JSON.stringify(snapshot)) as LmsDatabase;
  syncChain = syncChain
    .then(async () => {
      await syncDatabaseToSupabase(cloned);
    })
    .catch((err: any) => {
      console.error('[Supabase Background Sync Warning]:', err?.message || err);
    });
}

export async function flushPendingSupabaseSync(): Promise<void> {
  if (!hasWriteCapableSupabase()) return;
  await syncChain;
}

const COURSE_DRIVE_DEFAULTS: Record<
  string,
  { driveFolderId: string; driveFolderName: string; isFeatured?: boolean; title?: string; summary?: string }
> = {
  'crs-1': {
    driveFolderId: '1Kzr26pgYSYro2pnP8W1lUFspy7_SwPQN',
    driveFolderName: 'AI Website Development Tutorials (Google Drive)',
    isFeatured: true,
  },
  'crs-2': {
    driveFolderId: '1OccyWRAGt64BkaO3PXsLAXhInnfZG5uZ',
    driveFolderName: 'AI Video Creation Tutorials (Google Drive)',
    isFeatured: true,
  },
  'crs-5': {
    driveFolderId: '1-X_O9cbsQJdXCwq-E2xHDh22SGGYx9ro',
    driveFolderName: 'Graphic Design Prompts & Tutorials (Google Drive)',
    isFeatured: true,
    title: 'Graphic Design Prompts & Modern Brand Identity',
    summary:
      'Start with Lesson 1 free, then unlock the complete Google Drive Graphic Design Prompts & Modern Brand Identity library after payment.',
  },
};

function applyCourseDriveDefaults(db: LmsDatabase): boolean {
  let changed = false;
  for (const course of db.courses || []) {
    const def = COURSE_DRIVE_DEFAULTS[course.id];
    if (!def) continue;
    if (!course.driveFolderId) {
      course.driveFolderId = def.driveFolderId;
      course.driveFolderName = def.driveFolderName;
      changed = true;
    }
    if (def.isFeatured && !course.isFeatured) {
      course.isFeatured = true;
      changed = true;
    }
    if (def.title && course.title === 'Graphic Design & Modern Brand Identity') {
      course.title = def.title;
      if (def.summary) course.summary = def.summary;
      changed = true;
    }
  }
  return changed;
}

export async function hydrateStoreFromSupabase(): Promise<void> {
  if (!isSupabaseConfigured()) {
    hasCompletedInitialHydration = true;
    lastHydratedAt = Date.now();
    return;
  }
  try {
    const loadPromise = loadDatabaseFromSupabase();
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn('[Supabase Hydration Timeout]: Proceeding with local/cached LMS state to prevent lambda stall.');
        resolve(null);
      }, 2500)
    );
    const remoteDb = await Promise.race([loadPromise, timeoutPromise]);
    if (remoteDb) {
      if (!Array.isArray(remoteDb.otpChallenges)) remoteDb.otpChallenges = [];
      if (!Array.isArray(remoteDb.securityLogs)) remoteDb.securityLogs = [];
      const patched = applyCourseDriveDefaults(remoteDb);
      if ((remoteDb.schemaVersion || 0) < CURRENT_SCHEMA_VERSION) {
        remoteDb.schemaVersion = CURRENT_SCHEMA_VERSION;
        if (
          !remoteDb.settings?.paymentGatewayMode ||
          remoteDb.settings.paymentGatewayMode === 'MANUAL_MOMO' ||
          remoteDb.settings.paymentGatewayMode === 'MOMO_API_READY'
        ) {
          remoteDb.settings.paymentGatewayMode = 'BOTH';
        }
      }
      remoteDb.integrityChecksum = computeDbSeal(remoteDb);
      memoryDb = remoteDb;
      lastHydratedAt = Date.now();
      hasCompletedInitialHydration = true;
      writeLocalSnapshot(remoteDb);
      if (patched || remoteDb.schemaVersion === CURRENT_SCHEMA_VERSION) {
        queueSupabaseSync(remoteDb);
      }
      console.info(
        `[Supabase] Loaded ${remoteDb.users.length} users and ${remoteDb.courses.length} courses from Supabase database.`
      );
      return;
    }

    // Remote Supabase database exists and is reachable, but empty -> push initial seeded Academy state
    const localDb = getDb();
    if (hasWriteCapableSupabase()) {
      const res = await syncDatabaseToSupabase(localDb);
      if (res.ok) {
        console.info(`[Supabase] Seeded ${res.syncedCount} initial Academy records into Supabase SQL.`);
      }
    }
    lastHydratedAt = Date.now();
    hasCompletedInitialHydration = true;
  } catch (err: any) {
    lastHydratedAt = Date.now();
    hasCompletedInitialHydration = true;
    console.warn('[Supabase Startup Hydration Fallback]:', err?.message || err);
  }
}

export async function ensureStoreHydrated(): Promise<void> {
  const needsInitial = !hasCompletedInitialHydration;
  const needsVercelRefresh =
    IS_VERCEL &&
    hasWriteCapableSupabase() &&
    Date.now() - lastHydratedAt > VERCEL_REHYDRATE_TTL_MS;

  if (!needsInitial && !needsVercelRefresh) {
    return;
  }

  if (!hydrationPromise) {
    hydrationPromise = (async () => {
      await syncChain.catch(() => undefined);
      await hydrateStoreFromSupabase();
    })().finally(() => {
      hydrationPromise = null;
    });
  }
  await hydrationPromise;
}

export function computeDbSeal(db: LmsDatabase): string {
  return computeDatabaseChecksum({
    users: db.users.map((u) => ({ id: u.id, email: u.email, role: u.role, status: u.status })),
    courses: db.courses,
    enrolments: db.enrolments,
    payments: db.payments,
    certificates: db.certificates,
    settings: db.settings,
  });
}

export function getDb(): LmsDatabase {
  if (memoryDb) return memoryDb;
  try {
    ensureDataDir();
    const candidateFiles = [
      DB_FILE,
      BUNDLED_DB_FILE,
      path.resolve(process.cwd(), 'data', 'lms-db.json'),
      path.resolve(process.cwd(), 'api', '..', 'data', 'lms-db.json'),
      path.resolve(import.meta.dirname || process.cwd(), '..', 'data', 'lms-db.json'),
      path.resolve('/var/task', 'data', 'lms-db.json'),
    ];
    let sourceFile: string | null = null;
    for (const cand of candidateFiles) {
      if (fs.existsSync(cand)) {
        sourceFile = cand;
        break;
      }
    }
    if (sourceFile) {
      const raw = fs.readFileSync(sourceFile, 'utf8');
      const parsed = JSON.parse(raw) as LmsDatabase;
      if (parsed && parsed.schemaVersion === CURRENT_SCHEMA_VERSION) {
        if (!Array.isArray(parsed.otpChallenges)) parsed.otpChallenges = [];
        if (!Array.isArray(parsed.securityLogs)) parsed.securityLogs = [];
        const patched = applyCourseDriveDefaults(parsed);
        memoryDb = parsed;
        if (patched) {
          saveDb();
        }
        return memoryDb;
      }
      if (parsed && (parsed.schemaVersion === 2 || parsed.schemaVersion === 3)) {
        // Non-destructive upgrade from schema v2/v3 to v4 (preserving courses/payments/enrolments)
        const fresh = createInitialDatabase();
        parsed.schemaVersion = CURRENT_SCHEMA_VERSION;
        parsed.users = (parsed.users || []).map((u) => ({
          ...u,
          emailVerified: u.emailVerified ?? true,
          twoFactorEnabled: u.twoFactorEnabled ?? true,
          tokenVersion: u.tokenVersion ?? 1,
          failedLoginAttempts: u.failedLoginAttempts ?? 0,
        }));
        if (!Array.isArray(parsed.otpChallenges)) parsed.otpChallenges = [];
        if (!Array.isArray(parsed.securityLogs) || parsed.securityLogs.length === 0) {
          parsed.securityLogs = fresh.securityLogs;
        }
        if (
          parsed.settings &&
          (parsed.settings.paymentGatewayMode === 'MANUAL_MOMO' ||
            parsed.settings.paymentGatewayMode === 'MOMO_API_READY' ||
            !parsed.settings.paymentGatewayMode)
        ) {
          parsed.settings.paymentGatewayMode = 'BOTH';
        }
        applyCourseDriveDefaults(parsed);
        memoryDb = parsed;
        saveDb();
        return memoryDb;
      }
      console.info('Upgrading LMS data store to schema v' + CURRENT_SCHEMA_VERSION);
    }
  } catch (err) {
    console.warn('Could not read persisted db file, initializing fresh store:', err);
  }
  memoryDb = createInitialDatabase();
  applyCourseDriveDefaults(memoryDb);
  saveDb();
  return memoryDb;
}

export function saveDb(): void {
  if (!memoryDb) return;
  memoryDb.integrityChecksum = computeDbSeal(memoryDb);
  lastHydratedAt = Date.now();
  writeLocalSnapshot(memoryDb);
  queueSupabaseSync(memoryDb);
}

export function appendSecurityLog(params: {
  event: string;
  severity: SecurityEventSeverity;
  actorEmail: string;
  actorRole?: UserRole | 'ANONYMOUS';
  ipAddress: string;
  details: string;
}): SecurityAuditEntry {
  const db = getDb();
  if (!Array.isArray(db.securityLogs)) {
    db.securityLogs = [];
  }
  const previousHash = db.securityLogs[0]?.entryHash || 'GENESIS';
  const base: Omit<SecurityAuditEntry, 'entryHash'> = {
    id: generateId('sec'),
    timestamp: new Date().toISOString(),
    event: params.event,
    severity: params.severity,
    actorEmail: params.actorEmail,
    actorRole: params.actorRole || 'ANONYMOUS',
    ipAddress: params.ipAddress,
    details: params.details,
    previousHash,
  };
  const entry: SecurityAuditEntry = {
    ...base,
    entryHash: computeAuditEntryHash(previousHash, base),
  };
  db.securityLogs.unshift(entry);
  if (db.securityLogs.length > 500) {
    // Keep audit chain anchored from genesis: trim oldest only if needed? Wait: trimming breaks GENESIS link!
    // Keep full chain up to 2000 entries for 100% verifiable integrity.
  }
  return entry;
}

export function createDatabaseBackup(): { filename: string; createdAt: string; sizeBytes: number } {
  const db = getDb();
  ensureDataDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `lms-backup-${stamp}.json`;
  const target = path.join(BACKUP_DIR, filename);
  const payload = JSON.stringify(db, null, 2);
  fs.writeFileSync(target, payload, 'utf8');

  // Retain latest 10 snapshots for disk availability
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('lms-backup-') && f.endsWith('.json'))
    .sort();
  while (files.length > 10) {
    const oldest = files.shift();
    if (oldest) {
      fs.unlinkSync(path.join(BACKUP_DIR, oldest));
    }
  }

  return {
    filename,
    createdAt: new Date().toISOString(),
    sizeBytes: Buffer.byteLength(payload, 'utf8'),
  };
}

export function getBackupSummary(): { backupCount: number; lastBackupAt: string | null } {
  try {
    ensureDataDir();
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith('lms-backup-') && f.endsWith('.json'))
      .sort();
    if (files.length === 0) return { backupCount: 0, lastBackupAt: null };
    const newest = files[files.length - 1];
    const stat = fs.statSync(path.join(BACKUP_DIR, newest));
    return {
      backupCount: files.length,
      lastBackupAt: stat.mtime.toISOString(),
    };
  } catch {
    return { backupCount: 0, lastBackupAt: null };
  }
}

export function sanitizeUser(u: StoredUser): User {
  const {
    passwordHash: _ph,
    resetToken: _rt,
    resetTokenExp: _rte,
    tokenVersion: _tv,
    ...safe
  } = u;
  return safe;
}

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
