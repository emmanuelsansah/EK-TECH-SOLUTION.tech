export type UserRole = 'SUPER_ADMIN' | 'INSTRUCTOR' | 'STUDENT';

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl: string;
  bio: string;
  title: string;
  location: string;
  status: 'ACTIVE' | 'SUSPENDED';
  emailVerified?: boolean;
  twoFactorEnabled?: boolean;
  lastLoginAt?: string;
  failedLoginAttempts?: number;
  lockedUntil?: number;
  createdAt: string;
}

export type SecurityEventSeverity = 'INFO' | 'WARN' | 'CRITICAL';

export interface SecurityAuditEntry {
  id: string;
  timestamp: string;
  event: string;
  severity: SecurityEventSeverity;
  actorEmail: string;
  actorRole?: UserRole | 'ANONYMOUS';
  ipAddress: string;
  details: string;
  previousHash: string;
  entryHash: string;
}

export interface EmailPreviewPayload {
  to: string;
  subject: string;
  code: string;
  purpose: 'LOGIN' | 'REGISTER' | 'PASSWORD_RESET';
  expiresInMinutes: number;
  deliveryMode: 'SMTP' | 'PREVIEW_OUTBOX';
}

export interface CiaSecurityOverview {
  confidentiality: {
    passwordHashing: string;
    fieldEncryption: string;
    sessionProtection: string;
    twoFactorEnforcedCount: number;
    totalUsersCount: number;
    smtpConfigured: boolean;
  };
  integrity: {
    auditChainValid: boolean;
    auditEntriesCount: number;
    brokenIndex: number | null;
    databaseChecksum: string;
    csrfOriginProtection: boolean;
    strictPasswordPolicy: boolean;
  };
  availability: {
    uptimeSeconds: number;
    rateLimitingActive: boolean;
    activeRateLimitBuckets: number;
    lockedAccountsCount: number;
    backupCount: number;
    lastBackupAt: string | null;
  };
  auditLogs: SecurityAuditEntry[];
}

export type SupabaseDriverMode = 'SUPABASE_POSTGRES_SQL' | 'SUPABASE_REST_API' | 'LOCAL_JSON_FALLBACK';

export interface SupabaseConnectionStatus {
  configured: boolean;
  driver: SupabaseDriverMode;
  projectRef: string;
  projectUrl: string;
  hasDatabaseUrl: boolean;
  hasSupabaseUrl: boolean;
  hasServiceRoleKey: boolean;
  hasAnonKey: boolean;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

export interface SupabaseTestResult {
  connected: boolean;
  driver: SupabaseDriverMode;
  latencyMs: number;
  databaseName?: string;
  postgresVersion?: string;
  tablesCount?: number;
  message: string;
  error?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  orderIndex: number;
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  categoryId: string;
  instructorId: string;
  thumbnailUrl: string;
  summary: string;
  description: string;
  priceGhs: number;
  isFree: boolean;
  duration: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  isPublished: boolean;
  isFeatured: boolean;
  driveFolderId?: string;
  driveFolderName?: string;
  learningObjectives: string[];
  requirements: string[];
  completionRequirement: string;
  createdAt: string;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  description: string;
  orderIndex: number;
}

export interface Lesson {
  id: string;
  moduleId: string;
  courseId: string;
  title: string;
  description: string;
  videoUrl: string;
  driveFileId?: string;
  durationMinutes: number;
  pdfTitle: string;
  pdfSummary: string;
  practicalExercise: string;
  orderIndex: number;
  isFreePreview: boolean;
  locked?: boolean;
}

export interface Enrolment {
  id: string;
  studentId: string;
  courseId: string;
  status: 'ACTIVE' | 'COMPLETED' | 'REVOKED';
  progressPercent: number;
  completedLessonIds: string[];
  lastLessonId?: string;
  enrolledAt: string;
  completedAt?: string;
  driveAccessEmail?: string;
  driveAccessGrantedAt?: string;
}

export type PaymentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface Payment {
  id: string;
  studentId: string;
  courseId: string;
  fullName: string;
  email: string;
  amountGhs: number;
  senderPhone: string;
  transactionId: string;
  paymentMethod?: 'MANUAL_MOMO' | 'PAYSTACK';
  gatewayReference?: string;
  gatewayChannel?: string;
  paymentDate: string;
  screenshotDataUrl?: string;
  status: PaymentStatus;
  adminNote?: string;
  studentReply?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface Assignment {
  id: string;
  courseId: string;
  title: string;
  instructions: string;
  dueDate: string;
  maxScore: number;
  createdAt: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  courseId: string;
  studentId: string;
  submissionText: string;
  projectUrl?: string;
  status: 'SUBMITTED' | 'GRADED';
  score?: number;
  feedback?: string;
  submittedAt: string;
  gradedAt?: string;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  correctIndex: number;
}

export interface Quiz {
  id: string;
  courseId: string;
  title: string;
  description: string;
  passingScore: number;
  questions: QuizQuestion[];
  createdAt: string;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  courseId: string;
  studentId: string;
  answers: number[];
  scorePercent: number;
  passed: boolean;
  attemptedAt: string;
}

export interface Certificate {
  id: string;
  certificateNumber: string;
  studentId: string;
  courseId: string;
  studentName: string;
  courseTitle: string;
  instructorName: string;
  issuedAt: string;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'PAYMENT' | 'ENROLMENT' | 'GRADE' | 'ANNOUNCEMENT' | 'SYSTEM';
  isRead: boolean;
  createdAt: string;
}

export interface SupportMessage {
  id: string;
  senderId?: string;
  senderName: string;
  senderEmail: string;
  recipientRole: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';
  recipientId?: string;
  courseId?: string;
  subject: string;
  body: string;
  replyBody?: string;
  status: 'OPEN' | 'REPLIED' | 'RESOLVED';
  createdAt: string;
  repliedAt?: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  audience: 'ALL' | 'STUDENTS' | 'INSTRUCTORS';
  authorId: string;
  createdAt: string;
}

export interface Testimonial {
  id: string;
  name: string;
  role: string;
  organization: string;
  courseCompleted: string;
  quote: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

export interface WebsiteContent {
  heroHeadline: string;
  heroSubheadline: string;
  aboutTitle: string;
  aboutMission: string;
  aboutVision: string;
  announcementBanner: string;
  testimonials: Testimonial[];
  faqs: FaqItem[];
}

export interface SystemSettings {
  academyName: string;
  tagline: string;
  momoBusinessName: string;
  momoNumber: string;
  whatsappNumber: string;
  supportEmail: string;
  currency: string;
  allowPublicRegistration: boolean;
  paymentGatewayMode: 'MANUAL_MOMO' | 'PAYSTACK' | 'BOTH' | 'MOMO_API_READY';
}

export interface PublicBootstrap {
  categories: Category[];
  courses: Course[];
  instructors: Array<Pick<User, 'id' | 'fullName' | 'avatarUrl' | 'bio' | 'title' | 'location'>>;
  website: WebsiteContent;
  settings: SystemSettings;
  paystackConfigured?: boolean;
  stats: {
    activeLearners: number;
    publishedCourses: number;
    practicalModules: number;
    completionRate: number;
  };
}
