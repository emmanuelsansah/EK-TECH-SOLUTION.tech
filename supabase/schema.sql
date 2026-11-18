-- ============================================================================
-- EK TECH SOLUTIONS ONLINE ACADEMY — COMPLETE SUPABASE POSTGRESQL SCHEMA
-- Includes normalized LMS entities, Email 2FA OTP challenges, SHA-256 audit ledger,
-- and Row Level Security (RLS) policies aligned with the CIA Security Triad.
-- ============================================================================

create extension if not exists "pgcrypto";

-- 1. USERS (RBAC + Email 2FA + Account Lockout + Session Token Version)
create table if not exists public.users (
  id text primary key default (gen_random_uuid()::text),
  full_name text not null,
  email text not null unique,
  phone text not null default '',
  password_hash text not null,
  role text not null check (role in ('SUPER_ADMIN', 'INSTRUCTOR', 'STUDENT')) default 'STUDENT',
  avatar_url text not null default '',
  bio text not null default '',
  title text not null default '',
  location text not null default 'Accra, Ghana',
  status text not null check (status in ('ACTIVE', 'SUSPENDED')) default 'ACTIVE',
  email_verified boolean not null default true,
  two_factor_enabled boolean not null default true,
  token_version integer not null default 1,
  failed_login_attempts integer not null default 0,
  locked_until bigint,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

-- 2. CATEGORIES
create table if not exists public.categories (
  id text primary key default (gen_random_uuid()::text),
  name text not null,
  slug text not null unique,
  description text not null default '',
  order_index integer not null default 0
);

-- 3. COURSES
create table if not exists public.courses (
  id text primary key default (gen_random_uuid()::text),
  title text not null,
  slug text not null unique,
  category_id text references public.categories(id) on delete set null,
  instructor_id text references public.users(id) on delete set null,
  thumbnail_url text not null default '',
  summary text not null default '',
  description text not null default '',
  price_ghs numeric(10,2) not null default 0,
  is_free boolean not null default false,
  duration text not null default '4 Weeks',
  difficulty text not null check (difficulty in ('Beginner', 'Intermediate', 'Advanced')) default 'Beginner',
  is_published boolean not null default false,
  is_featured boolean not null default false,
  drive_folder_id text,
  drive_folder_name text,
  learning_objectives jsonb not null default '[]'::jsonb,
  requirements jsonb not null default '[]'::jsonb,
  completion_requirement text not null default 'Complete all lessons and pass the final assessment.',
  created_at timestamptz not null default now()
);

-- 4. MODULES
create table if not exists public.modules (
  id text primary key default (gen_random_uuid()::text),
  course_id text not null references public.courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  order_index integer not null default 1
);

-- 5. LESSONS
create table if not exists public.lessons (
  id text primary key default (gen_random_uuid()::text),
  module_id text not null references public.modules(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  video_url text not null default '',
  drive_file_id text,
  duration_minutes integer not null default 15,
  pdf_title text not null default '',
  pdf_summary text not null default '',
  practical_exercise text not null default '',
  order_index integer not null default 1,
  is_free_preview boolean not null default false
);

-- 6. ENROLMENTS
create table if not exists public.enrolments (
  id text primary key default (gen_random_uuid()::text),
  student_id text not null references public.users(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  status text not null check (status in ('ACTIVE', 'COMPLETED', 'REVOKED')) default 'ACTIVE',
  progress_percent integer not null default 0,
  completed_lesson_ids jsonb not null default '[]'::jsonb,
  last_lesson_id text references public.lessons(id) on delete set null,
  drive_access_email text,
  drive_access_granted_at timestamptz,
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (student_id, course_id)
);

-- 7. MTN MOBILE MONEY VERIFICATION LEDGER
create table if not exists public.payments (
  id text primary key default (gen_random_uuid()::text),
  student_id text not null references public.users(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  full_name text not null,
  email text not null,
  amount_ghs numeric(10,2) not null,
  sender_phone text not null,
  transaction_id text not null,
  payment_method text not null default 'MANUAL_MOMO',
  gateway_reference text,
  gateway_channel text,
  payment_date text not null,
  screenshot_data_url text,
  status text not null check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')) default 'PENDING',
  admin_note text,
  student_reply text,
  reviewed_by text references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_payments_unique_active_tx
  on public.payments (lower(transaction_id))
  where status in ('PENDING', 'APPROVED');

-- 8. ASSIGNMENTS & SUBMISSIONS
create table if not exists public.assignments (
  id text primary key default (gen_random_uuid()::text),
  course_id text not null references public.courses(id) on delete cascade,
  title text not null,
  instructions text not null,
  due_date text not null,
  max_score integer not null default 100,
  created_at timestamptz not null default now()
);

create table if not exists public.assignment_submissions (
  id text primary key default (gen_random_uuid()::text),
  assignment_id text not null references public.assignments(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  student_id text not null references public.users(id) on delete cascade,
  submission_text text not null,
  project_url text,
  status text not null check (status in ('SUBMITTED', 'GRADED')) default 'SUBMITTED',
  score integer,
  feedback text,
  submitted_at timestamptz not null default now(),
  graded_at timestamptz
);

-- 9. QUIZZES & ATTEMPTS
create table if not exists public.quizzes (
  id text primary key default (gen_random_uuid()::text),
  course_id text not null references public.courses(id) on delete cascade,
  title text not null,
  description text not null default '',
  passing_score integer not null default 70,
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id text primary key default (gen_random_uuid()::text),
  quiz_id text not null references public.quizzes(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  student_id text not null references public.users(id) on delete cascade,
  answers jsonb not null default '[]'::jsonb,
  score_percent integer not null,
  passed boolean not null,
  attempted_at timestamptz not null default now()
);

-- 10. CERTIFICATES
create table if not exists public.certificates (
  id text primary key default (gen_random_uuid()::text),
  certificate_number text not null unique,
  student_id text not null references public.users(id) on delete cascade,
  course_id text not null references public.courses(id) on delete cascade,
  student_name text not null,
  course_title text not null,
  instructor_name text not null,
  issued_at timestamptz not null default now()
);

-- 11. NOTIFICATIONS, SUPPORT MESSAGES, ANNOUNCEMENTS
create table if not exists public.notifications (
  id text primary key default (gen_random_uuid()::text),
  user_id text not null references public.users(id) on delete cascade,
  title text not null,
  message text not null,
  type text not null default 'SYSTEM',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id text primary key default (gen_random_uuid()::text),
  sender_id text references public.users(id) on delete set null,
  sender_name text not null,
  sender_email text not null,
  recipient_role text not null default 'ADMIN',
  recipient_id text references public.users(id) on delete set null,
  course_id text references public.courses(id) on delete set null,
  subject text not null,
  body text not null,
  reply_body text,
  status text not null check (status in ('OPEN', 'REPLIED', 'RESOLVED')) default 'OPEN',
  created_at timestamptz not null default now(),
  replied_at timestamptz
);

create table if not exists public.announcements (
  id text primary key default (gen_random_uuid()::text),
  title text not null,
  message text not null,
  audience text not null check (audience in ('ALL', 'STUDENTS', 'INSTRUCTORS')) default 'ALL',
  author_id text references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 12. WEBSITE CONTENT & SYSTEM SETTINGS
create table if not exists public.website_content (
  id integer primary key default 1,
  hero_headline text not null default '',
  hero_subheadline text not null default '',
  about_title text not null default '',
  about_mission text not null default '',
  about_vision text not null default '',
  announcement_banner text not null default '',
  testimonials jsonb not null default '[]'::jsonb,
  faqs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  id integer primary key default 1,
  academy_name text not null default 'EK TECH SOLUTIONS',
  tagline text not null default 'Learn Technology. Build with AI. Create the Future.',
  momo_business_name text not null default 'EK TECH SOLUTIONS',
  momo_number text not null default '0551464715',
  whatsapp_number text not null default '0551464715',
  support_email text not null default 'admissions@ektechsolutions.com',
  currency text not null default 'GH₵',
  allow_public_registration boolean not null default true,
  payment_gateway_mode text not null default 'BOTH'
);

-- 13. CIA SECURITY: EMAIL 2FA CHALLENGES & HASH-CHAINED AUDIT LEDGER
create table if not exists public.otp_challenges (
  id text primary key,
  email text not null,
  user_id text references public.users(id) on delete cascade,
  purpose text not null check (purpose in ('LOGIN', 'REGISTER', 'PASSWORD_RESET')),
  otp_hash text not null,
  otp_salt text not null,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  expires_at bigint not null,
  last_sent_at bigint not null,
  pending_user_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.security_audit_logs (
  id text primary key,
  timestamp timestamptz not null default now(),
  event text not null,
  severity text not null check (severity in ('INFO', 'WARN', 'CRITICAL')) default 'INFO',
  actor_email text not null,
  actor_role text not null default 'ANONYMOUS',
  ip_address text not null default '',
  details text not null default '',
  previous_hash text not null,
  entry_hash text not null
);

create table if not exists public.lms_state_meta (
  id integer primary key default 1,
  schema_version integer not null default 3,
  integrity_checksum text,
  updated_at timestamptz not null default now()
);

-- PERFORMANCE & SECURITY INDEXES
create index if not exists idx_lessons_course_order on public.lessons (course_id, order_index);
create index if not exists idx_enrolments_student on public.enrolments (student_id);
create index if not exists idx_payments_student on public.payments (student_id, status);
create index if not exists idx_otp_challenges_email on public.otp_challenges (email, purpose);
create index if not exists idx_security_audit_timestamp on public.security_audit_logs (timestamp desc);

-- ============================================================================
-- ROW LEVEL SECURITY (CONFIDENTIALITY & INTEGRITY ENFORCEMENT)
-- ============================================================================
alter table public.users enable row level security;
alter table public.categories enable row level security;
alter table public.courses enable row level security;
alter table public.modules enable row level security;
alter table public.lessons enable row level security;
alter table public.enrolments enable row level security;
alter table public.payments enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.certificates enable row level security;
alter table public.notifications enable row level security;
alter table public.support_messages enable row level security;
alter table public.announcements enable row level security;
alter table public.website_content enable row level security;
alter table public.system_settings enable row level security;
alter table public.otp_challenges enable row level security;
alter table public.security_audit_logs enable row level security;
alter table public.lms_state_meta enable row level security;

-- Public read-only access ONLY to published catalog tables; all sensitive tables are server-only via service_role.
drop policy if exists "Public can read categories" on public.categories;
create policy "Public can read categories" on public.categories
  for select using (true);

drop policy if exists "Public can read published courses" on public.courses;
create policy "Public can read published courses" on public.courses
  for select using (is_published = true);

-- Non-destructive column upgrades for existing deployments
alter table public.payments add column if not exists payment_method text not null default 'MANUAL_MOMO';
alter table public.payments add column if not exists gateway_reference text;
alter table public.payments add column if not exists gateway_channel text;
