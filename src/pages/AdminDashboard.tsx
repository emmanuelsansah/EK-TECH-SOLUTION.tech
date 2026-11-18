import React, { useEffect, useState } from 'react';
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  CreditCard,
  Database,
  Download,
  Eye,
  FileText,
  FolderTree,
  Globe,
  GraduationCap,
  KeyRound,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Unlock,
  User as UserIcon,
  UserCheck,
  Users,
  Video,
  X,
  XCircle,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  disconnectGoogleDrive,
  getDriveAccessToken,
  getDriveUser,
  initDriveAuth,
  shareDriveFileWithEmail,
  signInWithGoogleDrive,
  subscribeDriveAuth,
} from '../lib/googleDrive';
import { testSupabaseBrowserConnection, type SupabaseClientProbeResult } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { DashboardShell, type NavItem } from '../components/DashboardShell';
import { GoogleDrivePanel, GoogleSignInButton } from '../components/GoogleDrivePanel';
import { StatusIndicator } from '../components/UiPrimitives';
import type {
  Announcement,
  Assignment,
  AssignmentSubmission,
  Category,
  Certificate,
  CiaSecurityOverview,
  Course,
  Enrolment,
  Lesson,
  Module,
  NotificationItem,
  Payment,
  Quiz,
  SupabaseConnectionStatus,
  SupabaseTestResult,
  SupportMessage,
  SystemSettings,
  User,
  WebsiteContent,
} from '../types';

interface AdminOverview {
  stats: {
    totalStudents: number;
    totalInstructors: number;
    totalPublishedCourses: number;
    totalEnrolledStudents: number;
    totalCompletedCourses: number;
    pendingPayments: number;
    approvedPayments: number;
    rejectedPayments: number;
    totalVerifiedRevenue: number;
  };
  users: User[];
  categories: Category[];
  courses: Course[];
  modules: Module[];
  lessons: Lesson[];
  enrolments: Enrolment[];
  payments: Payment[];
  assignments: Assignment[];
  submissions: AssignmentSubmission[];
  quizzes: Quiz[];
  certificates: Certificate[];
  announcements: Announcement[];
  notifications: NotificationItem[];
  messages: SupportMessage[];
  website: WebsiteContent;
  settings: SystemSettings;
}

export function AdminDashboard() {
  const { user, bootstrap, refreshBootstrap, refreshUser, logout } = useApp();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [data, setData] = useState<AdminOverview | null>(null);
  const [securityData, setSecurityData] = useState<CiaSecurityOverview | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [dbStatus, setDbStatus] = useState<SupabaseConnectionStatus | null>(null);
  const [dbSchemaSql, setDbSchemaSql] = useState('');
  const [dbSeedSql, setDbSeedSql] = useState('');
  const [dbTableList, setDbTableList] = useState<string[]>([]);
  const [dbTestResult, setDbTestResult] = useState<(SupabaseTestResult & { status?: SupabaseConnectionStatus }) | null>(null);
  const [dbLoading, setDbLoading] = useState(false);
  const [dbSyncing, setDbSyncing] = useState(false);
  const [browserProbe, setBrowserProbe] = useState<SupabaseClientProbeResult | null>(null);
  const [browserProbeLoading, setBrowserProbeLoading] = useState(false);
  const [showSqlPreview, setShowSqlPreview] = useState(true);
  const [sqlTab, setSqlTab] = useState<'schema' | 'seed'>('schema');
  const [sqlCopied, setSqlCopied] = useState(false);
  const [seedCopied, setSeedCopied] = useState(false);
  const [notice, setNotice] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Table search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Payment inspection modal
  const [inspectPayment, setInspectPayment] = useState<Payment | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [confirmDriveShareOnApprove, setConfirmDriveShareOnApprove] = useState(true);
  const [confirmDriveApprovalModal, setConfirmDriveApprovalModal] = useState(false);
  const [approvingDecision, setApprovingDecision] = useState(false);

  // Reactive Google Drive OAuth status (token lives strictly in memory)
  const [driveConnected, setDriveConnected] = useState<boolean>(() => Boolean(getDriveAccessToken()));
  const [driveEmail, setDriveEmail] = useState<string | null>(() => getDriveUser()?.email || null);
  const [driveAuthLoading, setDriveAuthLoading] = useState(false);

  // Forms
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [newUser, setNewUser] = useState({ fullName: '', email: '', phone: '', password: '', role: 'INSTRUCTOR', title: '' });
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', message: '', audience: 'ALL' });
  const [newCourse, setNewCourse] = useState({
    title: '',
    categoryId: 'cat-1',
    instructorId: '',
    summary: '',
    priceGhs: 50,
    isFree: false,
    duration: '6 Weeks',
  });
  const [manualEnrol, setManualEnrol] = useState({ studentId: '', courseId: '' });
  const [replyTarget, setReplyTarget] = useState<SupportMessage | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [websiteDraft, setWebsiteDraft] = useState<WebsiteContent | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<SystemSettings | null>(null);
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    title: user?.title || '',
    newPassword: '',
  });

  const load = async () => {
    const res = await apiFetch<AdminOverview>('/api/admin/overview');
    setData(res);
    setWebsiteDraft(res.website);
    setSettingsDraft(res.settings);
    if (!newCourse.instructorId) {
      const firstInst = res.users.find((u) => u.role === 'INSTRUCTOR');
      if (firstInst) setNewCourse((c) => ({ ...c, instructorId: firstInst.id }));
    }
  };

  const loadSecurity = async () => {
    setSecurityLoading(true);
    try {
      const sec = await apiFetch<CiaSecurityOverview>('/api/admin/security');
      setSecurityData(sec);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to load CIA security console.');
    } finally {
      setSecurityLoading(false);
    }
  };

  const loadDatabaseInfo = async () => {
    setDbLoading(true);
    try {
      const res = await apiFetch<{
        status: SupabaseConnectionStatus;
        schemaSql: string;
        seedSql?: string;
        tableList: string[];
      }>('/api/admin/database');
      setDbStatus(res.status);
      setDbSchemaSql(res.schemaSql);
      if (res.seedSql) setDbSeedSql(res.seedSql);
      setDbTableList(res.tableList || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to load Supabase database status.');
    } finally {
      setDbLoading(false);
    }
  };

  useEffect(() => {
    load();
    const unsubInit = initDriveAuth(
      (fbUser) => {
        setDriveEmail(fbUser.email);
        setDriveConnected(Boolean(getDriveAccessToken()));
      },
      () => {
        setDriveConnected(Boolean(getDriveAccessToken()));
      }
    );
    const unsubState = subscribeDriveAuth(({ user: fbUser, token }) => {
      setDriveEmail(fbUser?.email || null);
      setDriveConnected(Boolean(token));
    });
    return () => {
      unsubInit();
      unsubState();
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'security') {
      loadSecurity();
    } else if (activeTab === 'database') {
      loadDatabaseInfo();
    }
  }, [activeTab]);

  if (!data || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF7] dark:bg-[#0D1117]">
        <div className="text-sm text-slate-500">Loading Super Administrator console...</div>
      </div>
    );
  }

  const courseMap = new Map(data.courses.map((c) => [c.id, c]));
  const userMap = new Map(data.users.map((u) => [u.id, u]));
  const catMap = new Map(data.categories.map((c) => [c.id, c]));
  const unreadNotifs = data.notifications.filter((n) => !n.isRead).length;

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'security', label: 'Security & CIA', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'database', label: 'Supabase SQL', icon: <Database className="w-4 h-4" /> },
    { id: 'payments', label: 'Payment Verification', icon: <CreditCard className="w-4 h-4" />, badge: data.stats.pendingPayments },
    { id: 'drive', label: 'Google Drive Videos', icon: <Video className="w-4 h-4" /> },
    { id: 'students', label: 'Students', icon: <GraduationCap className="w-4 h-4" /> },
    { id: 'instructors', label: 'Instructors', icon: <UserCheck className="w-4 h-4" /> },
    { id: 'courses', label: 'Courses', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'categories', label: 'Course Categories', icon: <FolderTree className="w-4 h-4" /> },
    { id: 'modules', label: 'Modules', icon: <Layers className="w-4 h-4" /> },
    { id: 'lessons', label: 'Lessons', icon: <Video className="w-4 h-4" /> },
    { id: 'enrolments', label: 'Enrolments', icon: <Users className="w-4 h-4" /> },
    { id: 'assignments', label: 'Assignments', icon: <FileText className="w-4 h-4" /> },
    { id: 'quizzes', label: 'Quizzes', icon: <ClipboardCheck className="w-4 h-4" /> },
    { id: 'certificates', label: 'Certificates', icon: <Award className="w-4 h-4" /> },
    { id: 'announcements', label: 'Announcements', icon: <Megaphone className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" />, badge: unreadNotifs },
    { id: 'messages', label: 'Messages', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'website', label: 'Website Management', icon: <Globe className="w-4 h-4" /> },
    { id: 'settings', label: 'System Settings', icon: <Settings className="w-4 h-4" /> },
    { id: 'profile', label: 'Administrator Profile', icon: <UserIcon className="w-4 h-4" /> },
  ];

  const getCourseDriveTargets = (courseId: string) => {
    const course = courseMap.get(courseId);
    const lessonFileIds = Array.from(
      new Set(
        data.lessons
          .filter((l) => l.courseId === courseId && l.driveFileId)
          .map((l) => l.driveFileId as string)
      )
    );
    return {
      course,
      folderId: course?.driveFolderId || '',
      folderName: course?.driveFolderName || 'Linked Course Drive Folder',
      lessonFileIds,
      hasDriveItems: Boolean(course?.driveFolderId || lessonFileIds.length > 0),
    };
  };

  const pendingDriveSharesCount = data.enrolments.filter((e) => {
    if (e.driveAccessEmail) return false;
    return getCourseDriveTargets(e.courseId).hasDriveItems;
  }).length;

  const handleConnectDriveInline = async () => {
    setDriveAuthLoading(true);
    setErrorMsg('');
    try {
      const res = await signInWithGoogleDrive();
      setDriveEmail(res.user.email);
      setDriveConnected(true);
      setConfirmDriveShareOnApprove(true);
      setNotice(`Google Drive connected (${res.user.email}). You can now share course videos directly upon payment approval.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Google Drive Sign-In failed.');
    } finally {
      setDriveAuthLoading(false);
    }
  };

  const handlePaymentDecision = async (
    paymentId: string,
    action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO',
    withExplicitDriveShare = false
  ) => {
    setErrorMsg('');
    setApprovingDecision(true);
    try {
      let driveSharedNotice = '';
      let driveSharedConfirmed = false;
      if (action === 'APPROVE' && withExplicitDriveShare && inspectPayment) {
        const targets = getCourseDriveTargets(inspectPayment.courseId);
        if (targets.hasDriveItems && getDriveAccessToken()) {
          if (targets.folderId) {
            await shareDriveFileWithEmail(targets.folderId, inspectPayment.email);
          } else {
            for (const fid of targets.lessonFileIds) {
              await shareDriveFileWithEmail(fid, inspectPayment.email);
            }
          }
          driveSharedConfirmed = true;
          driveSharedNotice = ` Google Drive access shared with ${inspectPayment.email}.`;
        }
      }
      await apiFetch(`/api/admin/payments/${paymentId}/decision`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          adminNote: decisionNote,
          driveAccessEmail: inspectPayment?.email,
          driveSharedConfirmed,
        }),
      });
      setInspectPayment(null);
      setConfirmDriveApprovalModal(false);
      setConfirmDriveShareOnApprove(true);
      setDecisionNote('');
      setNotice(
        `Payment ${
          action === 'APPROVE'
            ? `approved and student video access unlocked on ${inspectPayment?.email || 'sign-up email'}.${driveSharedNotice}`
            : action === 'REJECT'
            ? 'rejected.'
            : 'flagged for additional information.'
        }`
      );
      load();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setApprovingDecision(false);
    }
  };

  const exportRevenueCsv = () => {
    const rows = [
      ['Transaction ID', 'Student', 'Email', 'Course', 'Amount GHS', 'Sender MoMo', 'Date', 'Status'],
      ...data.payments.map((p) => [
        p.transactionId,
        p.fullName,
        p.email,
        courseMap.get(p.courseId)?.title || p.courseId,
        String(p.amountGhs),
        p.senderPhone,
        p.paymentDate,
        p.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EK_Tech_Transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const studentsList = data.users.filter((u) => u.role === 'STUDENT');
  const instructorsList = data.users.filter((u) => u.role === 'INSTRUCTOR');

  const filteredPayments = data.payments.filter((p) => {
    if (paymentFilter !== 'ALL' && p.status !== paymentFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        p.transactionId.toLowerCase().includes(q) ||
        p.fullName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.senderPhone.includes(q)
      );
    }
    return true;
  });

  const pagedPayments = filteredPayments.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));

  return (
    <DashboardShell
      roleLabel="Super Administrator"
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={(id) => {
        setActiveTab(id);
        setPage(1);
        setSearchQuery('');
      }}
      unreadNotifications={unreadNotifs}
    >
      {notice && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} className="underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* 1. DASHBOARD OVERVIEW */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'Verified Revenue', value: `GH₵ ${data.stats.totalVerifiedRevenue.toLocaleString()}` },
              { label: 'Pending MoMo Verifications', value: data.stats.pendingPayments },
              { label: 'Approved Payments', value: data.stats.approvedPayments },
              { label: 'Rejected Payments', value: data.stats.rejectedPayments },
              { label: 'Registered Students', value: data.stats.totalStudents },
              { label: 'Instructors', value: data.stats.totalInstructors },
              { label: 'Published Courses', value: data.stats.totalPublishedCourses },
              { label: 'Enrolled Students', value: data.stats.totalEnrolledStudents },
              { label: 'Completed Courses', value: data.stats.totalCompletedCourses },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className="p-4 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900"
              >
                <div className="text-xl font-extrabold font-mono tabular-nums text-[#111827] dark:text-white">
                  {kpi.value}
                </div>
                <div className="text-xs text-slate-500 mt-1">{kpi.label}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Recent Mobile Money Transactions</h2>
                <button
                  type="button"
                  onClick={() => setActiveTab('payments')}
                  className="text-xs font-semibold text-[#EA580C] dark:text-orange-400 hover:underline cursor-pointer"
                >
                  Open Verification Queue
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Student</th>
                      <th className="py-2 pr-3">TxID</th>
                      <th className="py-2 pr-3">Amount</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data.payments.slice(0, 6).map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 pr-3 font-medium">{p.fullName}</td>
                        <td className="py-2.5 pr-3 font-mono">{p.transactionId}</td>
                        <td className="py-2.5 pr-3 font-mono tabular-nums">GH₵ {p.amountGhs}</td>
                        <td className="py-2.5">
                          <StatusIndicator status={p.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:col-span-5 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
              <h2 className="text-base font-bold">Recent Student Registrations</h2>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {studentsList.slice(0, 6).map((s) => (
                  <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-semibold">{s.fullName}</div>
                      <div className="text-slate-500">{s.email}</div>
                    </div>
                    <span className="font-mono text-slate-400">{new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1B. CIA SECURITY & EMAIL 2FA CONSOLE */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-extrabold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#EA580C] dark:text-orange-400" />
                <span>CIA Triad Security &amp; Email 2FA Console</span>
              </h1>
              <p className="text-xs text-[#4B5563] dark:text-slate-400 mt-0.5">
                Confidentiality, Integrity &amp; Availability monitoring, cryptographic audit verification, and Email 2FA telemetry.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  setErrorMsg('');
                  try {
                    const res = await apiFetch('/api/admin/security/verify-integrity', { method: 'POST' });
                    setNotice(
                      res.valid
                        ? `Integrity Check Passed: SHA-256 ledger verified (${res.databaseChecksum.slice(0, 12)}...).`
                        : `Integrity anomaly detected at audit index ${res.brokenIndex}!`
                    );
                    await loadSecurity();
                  } catch (err: any) {
                    setErrorMsg(err.message);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verify Audit Chain Integrity</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  setErrorMsg('');
                  try {
                    const res = await apiFetch('/api/admin/security/backup', { method: 'POST' });
                    setNotice(`Verified database backup snapshot saved (${res.backup.filename}).`);
                    await loadSecurity();
                  } catch (err: any) {
                    setErrorMsg(err.message);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl hover:bg-[#FFF7F0] dark:hover:bg-slate-800 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Create Backup Snapshot</span>
              </button>
              <button
                type="button"
                onClick={loadSecurity}
                disabled={securityLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#E7DDD4] dark:border-slate-700 rounded-xl cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${securityLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {securityData ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Confidentiality */}
                <div className="p-5 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#111827] dark:text-white">
                      <Lock className="w-4 h-4 text-[#EA580C] dark:text-orange-400" />
                      <span>Confidentiality</span>
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        securityData.confidentiality.smtpConfigured
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {securityData.confidentiality.smtpConfigured ? 'SMTP Active' : 'Outbox Preview (Set SMTP_*)'}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-[#4B5563] dark:text-slate-300">
                    <div>
                      <span className="font-semibold text-[#111827] dark:text-white">Hashing:</span>{' '}
                      {securityData.confidentiality.passwordHashing}
                    </div>
                    <div>
                      <span className="font-semibold text-[#111827] dark:text-white">Encryption:</span>{' '}
                      {securityData.confidentiality.fieldEncryption}
                    </div>
                    <div>
                      <span className="font-semibold text-[#111827] dark:text-white">Sessions:</span>{' '}
                      {securityData.confidentiality.sessionProtection}
                    </div>
                    <div className="pt-1 font-mono text-[11px] text-[#EA580C] dark:text-orange-400">
                      Email 2FA Enforced: {securityData.confidentiality.twoFactorEnforcedCount} /{' '}
                      {securityData.confidentiality.totalUsersCount} accounts
                    </div>
                  </div>
                </div>

                {/* Integrity */}
                <div className="p-5 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#111827] dark:text-white">
                      <KeyRound className="w-4 h-4 text-[#EA580C] dark:text-orange-400" />
                      <span>Integrity</span>
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        securityData.integrity.auditChainValid
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                          : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                      }`}
                    >
                      {securityData.integrity.auditChainValid ? 'Hash Chain Valid' : 'Chain Anomaly'}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-[#4B5563] dark:text-slate-300">
                    <div>
                      <span className="font-semibold text-[#111827] dark:text-white">Audit Ledger:</span>{' '}
                      {securityData.integrity.auditEntriesCount} SHA-256 linked entries
                    </div>
                    <div>
                      <span className="font-semibold text-[#111827] dark:text-white">CSRF Origin Guard:</span>{' '}
                      {securityData.integrity.csrfOriginProtection ? 'Active on mutations' : 'Disabled'}
                    </div>
                    <div>
                      <span className="font-semibold text-[#111827] dark:text-white">Password Policy:</span>{' '}
                      {securityData.integrity.strictPasswordPolicy ? 'Strict 8+ complexity enforced' : 'Standard'}
                    </div>
                    <div className="pt-1 font-mono text-[11px] break-all text-[#6B7280] dark:text-slate-400">
                      DB Seal: {securityData.integrity.databaseChecksum.slice(0, 24)}...
                    </div>
                  </div>
                </div>

                {/* Availability */}
                <div className="p-5 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#111827] dark:text-white">
                      <ShieldCheck className="w-4 h-4 text-[#EA580C] dark:text-orange-400" />
                      <span>Availability</span>
                    </span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                      Protected
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-[#4B5563] dark:text-slate-300">
                    <div>
                      <span className="font-semibold text-[#111827] dark:text-white">API Uptime:</span>{' '}
                      <span className="font-mono">{securityData.availability.uptimeSeconds}s</span>
                    </div>
                    <div>
                      <span className="font-semibold text-[#111827] dark:text-white">Rate Limit Buckets:</span>{' '}
                      <span className="font-mono">{securityData.availability.activeRateLimitBuckets}</span> active windows
                    </div>
                    <div>
                      <span className="font-semibold text-[#111827] dark:text-white">Locked Accounts:</span>{' '}
                      <span className="font-mono">{securityData.availability.lockedAccountsCount}</span>
                    </div>
                    <div className="pt-1 font-mono text-[11px] text-[#6B7280] dark:text-slate-400">
                      Snapshots: {securityData.availability.backupCount}
                      {securityData.availability.lastBackupAt
                        ? ` · Last ${new Date(securityData.availability.lastBackupAt).toLocaleString()}`
                        : ''}
                    </div>
                  </div>
                </div>
              </div>

              {/* Brute-Force Locked Accounts */}
              {data.users.some((u) => u.lockedUntil && u.lockedUntil > Date.now()) && (
                <div className="p-5 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 space-y-3">
                  <h2 className="text-sm font-bold text-rose-800 dark:text-rose-300">
                    Locked Accounts (Brute-Force Protection Cooldown)
                  </h2>
                  <div className="space-y-2">
                    {data.users
                      .filter((u) => u.lockedUntil && u.lockedUntil > Date.now())
                      .map((u) => (
                        <div
                          key={u.id}
                          className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 flex items-center justify-between gap-4 text-xs"
                        >
                          <div>
                            <div className="font-bold">{u.fullName}</div>
                            <div className="text-slate-500 font-mono">{u.email}</div>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/admin/security/unlock-user/${u.id}`, { method: 'POST' });
                              setNotice(`Unlocked cooldown for ${u.email}.`);
                              await Promise.all([load(), loadSecurity()]);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Unlock Account</span>
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Tamper-Evident SHA-256 Security Audit Ledger */}
              <div className="rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
                <div className="px-5 py-4 border-b border-[#EFE7DF] dark:border-slate-800 flex items-center justify-between">
                  <h2 className="text-sm font-bold">SHA-256 Hash-Chained Security Audit Ledger</h2>
                  <span className="text-[11px] font-mono text-slate-500">
                    Showing latest {securityData.auditLogs.length} events
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-[#EFE7DF] dark:border-slate-800 bg-[#FFFBF7] dark:bg-slate-900/60 text-slate-500">
                      <tr>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Event</th>
                        <th className="py-3 px-4">Severity</th>
                        <th className="py-3 px-4">Actor</th>
                        <th className="py-3 px-4">IP</th>
                        <th className="py-3 px-4">Details</th>
                        <th className="py-3 px-4">Hash</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {securityData.auditLogs.map((entry) => (
                        <tr key={entry.id} className="hover:bg-[#FFFBF7] dark:hover:bg-slate-800/40">
                          <td className="py-2.5 px-4 font-mono whitespace-nowrap text-[11px] text-slate-500">
                            {new Date(entry.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-semibold text-[#111827] dark:text-white">
                            {entry.event}
                          </td>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                entry.severity === 'CRITICAL'
                                  ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                  : entry.severity === 'WARN'
                                  ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                  : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                              }`}
                            >
                              {entry.severity}
                            </span>
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-mono text-[11px]">{entry.actorEmail}</div>
                            {entry.actorRole && (
                              <div className="text-[10px] text-slate-400">{entry.actorRole}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">{entry.ipAddress}</td>
                          <td className="py-2.5 px-4 text-[#4B5563] dark:text-slate-300 max-w-xs">
                            {entry.details}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-slate-400">
                            {entry.entryHash.slice(0, 10)}...
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-500">
              Loading CIA Triad telemetry...
            </div>
          )}
        </div>
      )}

      {/* 1C. SUPABASE POSTGRESQL SQL DATABASE CONSOLE */}
      {activeTab === 'database' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-extrabold flex items-center gap-2">
                <Database className="w-5 h-5 text-[#EA580C] dark:text-orange-400" />
                <span>Supabase PostgreSQL SQL Database</span>
              </h1>
              <p className="text-xs text-[#4B5563] dark:text-slate-400 mt-0.5">
                Server-side PostgreSQL SQL driver (`pg`) &amp; Supabase Service-Role synchronization across all 20 RLS-protected LMS tables.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={dbLoading}
                onClick={async () => {
                  setErrorMsg('');
                  setDbLoading(true);
                  try {
                    const res = await apiFetch<SupabaseTestResult & { status: SupabaseConnectionStatus }>(
                      '/api/admin/database/test',
                      { method: 'POST' }
                    );
                    setDbTestResult(res);
                    if (res.status) setDbStatus(res.status);
                    if (res.connected) {
                      setNotice(res.message);
                    } else {
                      setErrorMsg(res.error || res.message);
                    }
                  } catch (err: any) {
                    setErrorMsg(err.message);
                  } finally {
                    setDbLoading(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] disabled:opacity-50 rounded-xl cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{dbLoading ? 'Testing Server...' : 'Test Server Connection'}</span>
              </button>
              <button
                type="button"
                disabled={browserProbeLoading}
                onClick={async () => {
                  setErrorMsg('');
                  setBrowserProbeLoading(true);
                  try {
                    const probe = await testSupabaseBrowserConnection();
                    setBrowserProbe(probe);
                    if (probe.connected) {
                      setNotice(probe.message);
                    } else {
                      setErrorMsg(probe.error || probe.message);
                    }
                  } catch (err: any) {
                    setErrorMsg(err.message);
                  } finally {
                    setBrowserProbeLoading(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{browserProbeLoading ? 'Probing Browser...' : 'Probe Browser API'}</span>
              </button>
              <button
                type="button"
                disabled={!dbStatus?.configured || dbSyncing}
                onClick={async () => {
                  setErrorMsg('');
                  setDbSyncing(true);
                  try {
                    const res = await apiFetch<{
                      ok: boolean;
                      syncedCount: number;
                      status: SupabaseConnectionStatus;
                    }>('/api/admin/database/sync', { method: 'POST' });
                    if (res.status) setDbStatus(res.status);
                    setNotice(`Successfully synchronized ${res.syncedCount} LMS records to Supabase SQL.`);
                  } catch (err: any) {
                    setErrorMsg(err.message);
                  } finally {
                    setDbSyncing(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl hover:bg-[#FFF7F0] dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${dbSyncing ? 'animate-spin' : ''}`} />
                <span>{dbSyncing ? 'Syncing to Supabase...' : 'Sync Academy Data to Supabase'}</span>
              </button>
              <button
                type="button"
                disabled={!dbSchemaSql}
                onClick={() => {
                  const blob = new Blob([dbSchemaSql], { type: 'application/sql;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'ektech_supabase_schema.sql';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl hover:bg-[#FFF7F0] dark:hover:bg-slate-800 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download schema.sql</span>
              </button>
              <button
                type="button"
                disabled={!dbSchemaSql}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(dbSchemaSql);
                    setSqlCopied(true);
                    setTimeout(() => setSqlCopied(false), 2000);
                  } catch {
                    setShowSqlPreview(true);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#E7DDD4] dark:border-slate-700 rounded-xl cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{sqlCopied ? 'Copied schema.sql!' : 'Copy schema.sql'}</span>
              </button>
              <button
                type="button"
                disabled={!dbSeedSql}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(dbSeedSql);
                    setSeedCopied(true);
                    setTimeout(() => setSeedCopied(false), 2000);
                  } catch {
                    // ignore
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{seedCopied ? 'Copied Seed SQL!' : 'Copy Seed SQL (Courses & RLS)'}</span>
              </button>
              <button
                type="button"
                disabled={!dbSeedSql}
                onClick={() => {
                  const blob = new Blob([dbSeedSql], { type: 'application/sql;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'ektech_supabase_seed.sql';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#E7DDD4] dark:border-slate-700 rounded-xl cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download seed.sql</span>
              </button>
            </div>
          </div>

          {dbStatus ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-5 p-5 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold">Active Persistence Driver</h2>
                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded font-mono ${
                        dbStatus.configured
                          ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                      }`}
                    >
                      {dbStatus.driver}
                    </span>
                  </div>
                  <div className="space-y-1.5 text-xs text-[#4B5563] dark:text-slate-300">
                    <div>
                      <span className="font-semibold text-[#111827] dark:text-white">Project Ref:</span>{' '}
                      <span className="font-mono font-bold text-[#EA580C] dark:text-orange-400">
                        {dbStatus.projectRef}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-[#111827] dark:text-white">API URL:</span>{' '}
                      <span className="font-mono break-all">{dbStatus.projectUrl}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-[#111827] dark:text-white">Connection State:</span>{' '}
                      {dbStatus.configured
                        ? dbStatus.hasDatabaseUrl
                          ? 'Connected (Direct PostgreSQL Pool Active)'
                          : dbStatus.hasServiceRoleKey
                          ? 'Connected (Supabase REST API with Service-Role Admin Key)'
                          : 'Connected (Supabase REST API with Verified Anon Key)'
                        : 'Awaiting Supabase credentials'}
                    </div>
                    <div>
                      <span className="font-semibold text-[#111827] dark:text-white">Last Synced:</span>{' '}
                      <span className="font-mono">
                        {dbStatus.lastSyncedAt ? new Date(dbStatus.lastSyncedAt).toLocaleString() : 'Not yet synced'}
                      </span>
                    </div>
                    {dbStatus.lastSyncError && (
                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-[11px] font-mono break-all">
                        {dbStatus.lastSyncError}
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-7 p-5 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-sm font-bold">Server Environment Secrets Checklist</h2>
                    <a
                      href={`https://supabase.com/dashboard/project/${dbStatus.projectRef}/sql/new`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-semibold text-[#EA580C] dark:text-orange-400 hover:underline"
                    >
                      Open Supabase SQL Editor &rarr;
                    </a>
                  </div>
                  <p className="text-xs text-[#4B5563] dark:text-slate-400">
                    Configure these secrets in your deployment / AI Studio Secrets panel (never entered in browser UI for Confidentiality):
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    {[
                      {
                        key: 'DATABASE_URL',
                        ok: dbStatus.hasDatabaseUrl,
                        desc: `postgresql://postgres:[PASSWORD]@db.${dbStatus.projectRef}.supabase.co:5432/postgres`,
                      },
                      {
                        key: 'SUPABASE_URL',
                        ok: dbStatus.hasSupabaseUrl,
                        desc: dbStatus.projectUrl,
                      },
                      {
                        key: 'SUPABASE_SERVICE_ROLE_KEY',
                        ok: dbStatus.hasServiceRoleKey,
                        desc: 'Server-only RLS-bypass key for Admin mutations',
                      },
                      {
                        key: 'SUPABASE_ANON_KEY',
                        ok: dbStatus.hasAnonKey,
                        desc: 'Public catalog key matching schema RLS policies',
                      },
                    ].map((item) => (
                      <div
                        key={item.key}
                        className="p-3 rounded-xl border border-[#EFE7DF] dark:border-slate-800 bg-[#FFFBF7] dark:bg-slate-800/50 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-[#111827] dark:text-white">{item.key}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              item.ok
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {item.ok ? 'Configured' : 'Missing'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{item.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {dbTestResult && (
                <div
                  className={`p-4 rounded-2xl border text-xs space-y-2 ${
                    dbTestResult.connected
                      ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                      : 'border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                    <span>
                      Connection Probe: {dbTestResult.connected ? 'ONLINE' : 'NOT CONNECTED'} ({dbTestResult.driver})
                    </span>
                    <span className="font-mono">{dbTestResult.latencyMs}ms</span>
                  </div>
                  <p>{dbTestResult.message}</p>
                  {(dbTestResult.databaseName || dbTestResult.postgresVersion || dbTestResult.tablesCount !== undefined) && (
                    <div className="flex flex-wrap gap-4 font-mono text-[11px]">
                      {dbTestResult.databaseName && <span>DB: {dbTestResult.databaseName}</span>}
                      {dbTestResult.postgresVersion && <span>Engine: {dbTestResult.postgresVersion}</span>}
                      {dbTestResult.tablesCount !== undefined && <span>Public Tables: {dbTestResult.tablesCount}</span>}
                    </div>
                  )}
                </div>
              )}

              {browserProbe && (
                <div
                  className={`p-4 rounded-2xl border text-xs space-y-2 ${
                    browserProbe.connected
                      ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300'
                      : 'border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                    <span>
                      Client Browser Probe: {browserProbe.connected ? 'ONLINE' : 'NOT CONNECTED'}
                    </span>
                    <span className="font-mono">{browserProbe.latencyMs}ms</span>
                  </div>
                  <p>{browserProbe.message}</p>
                  {browserProbe.tablesVerified.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                      <span className="font-sans font-semibold">Verified Accessible Tables:</span>
                      {browserProbe.tablesVerified.map((t) => (
                        <span
                          key={t}
                          className="px-2 py-0.5 rounded bg-white/70 dark:bg-slate-900/60 border border-emerald-300 dark:border-emerald-800"
                        >
                          public.{t}
                        </span>
                      ))}
                    </div>
                  )}
                  {browserProbe.error && (
                    <div className="text-[11px] text-rose-600 dark:text-rose-400 font-mono">
                      Error: {browserProbe.error}
                    </div>
                  )}
                </div>
              )}

              <div className="p-5 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold">Normalized PostgreSQL Tables ({dbTableList.length})</h2>
                    <p className="text-xs text-slate-500">
                      Every table enforces Row Level Security (RLS) plus SHA-256 tamper-evident audit logging.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSqlPreview(true);
                        setSqlTab('schema');
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer ${
                        showSqlPreview && sqlTab === 'schema'
                          ? 'bg-[#EA580C] text-white'
                          : 'border border-[#E7DDD4] dark:border-slate-700 hover:bg-[#FFF7F0] dark:hover:bg-slate-800'
                      }`}
                    >
                      schema.sql (DDL + Tables)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSqlPreview(true);
                        setSqlTab('seed');
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl cursor-pointer ${
                        showSqlPreview && sqlTab === 'seed'
                          ? 'bg-indigo-600 text-white'
                          : 'border border-[#E7DDD4] dark:border-slate-700 hover:bg-[#FFF7F0] dark:hover:bg-slate-800'
                      }`}
                    >
                      seed.sql (Populate Courses &amp; RLS)
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSqlPreview((s) => !s)}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showSqlPreview ? 'Collapse' : 'Expand'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {dbTableList.map((tbl) => (
                    <div
                      key={tbl}
                      className="px-3 py-2 rounded-xl border border-[#EFE7DF] dark:border-slate-800 bg-[#FFFBF7] dark:bg-slate-800/40 font-mono text-[11px] text-[#111827] dark:text-slate-200 truncate"
                      title={`public.${tbl}`}
                    >
                      public.{tbl}
                    </div>
                  ))}
                </div>

                {showSqlPreview && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Viewing: <strong className="text-slate-900 dark:text-white font-mono">{sqlTab === 'schema' ? 'supabase/schema.sql' : 'supabase/seed.sql'}</strong></span>
                      <a
                        href={`https://supabase.com/dashboard/project/${dbStatus.projectRef}/sql/new`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-[#EA580C] hover:underline"
                      >
                        Open Supabase SQL Editor &rarr;
                      </a>
                    </div>
                    <pre className="p-4 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-96 border border-slate-800">
                      {sqlTab === 'schema' ? dbSchemaSql : dbSeedSql || '-- Loading seed data...'}
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-8 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-500">
              Loading Supabase PostgreSQL SQL configuration...
            </div>
          )}
        </div>
      )}

      {/* 2. PAYMENT VERIFICATION (CRITICAL MODULE) */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-extrabold">MTN Mobile Money Payment Verification</h1>
              <p className="text-xs text-slate-500">
                Verify receipts sent to {data.settings.momoBusinessName} ({data.settings.momoNumber}) before activating
                course access.
              </p>
            </div>
            <button
              type="button"
              onClick={exportRevenueCsv}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="p-4 rounded-xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <div className="font-bold flex items-center gap-2">
                <span>Google Drive Auto-Access Status:</span>
                {driveConnected ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    Connected ({driveEmail})
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">
                    Not Connected in Browser Session
                  </span>
                )}
              </div>
              <p className="text-slate-500 dark:text-slate-400">
                {driveConnected
                  ? 'Approving a payment can immediately grant Reader access on the linked Drive folder to the student’s sign-up email.'
                  : 'Connect your academy Google Drive before approving payments so course video access can be shared automatically.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {pendingDriveSharesCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('drive')}
                  className="px-3 py-2 text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 rounded-lg cursor-pointer"
                >
                  {pendingDriveSharesCount} Paid Student(s) Need Drive Share →
                </button>
              )}
              {driveConnected ? (
                <button
                  type="button"
                  onClick={() => disconnectGoogleDrive()}
                  className="px-3 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  Disconnect Drive
                </button>
              ) : (
                <GoogleSignInButton onClick={handleConnectDriveInline} loading={driveAuthLoading} />
              )}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by Transaction ID, student name, email, or MoMo number..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              />
            </div>
            <div className="flex items-center gap-1 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
              {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => {
                    setPaymentFilter(st);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                    paymentFilter === st
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-500">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Sender MoMo</th>
                  <th className="py-3 px-4">Reference / TxID</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pagedPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <div className="font-semibold">{p.fullName}</div>
                      <div className="text-slate-500">{p.email}</div>
                    </td>
                    <td className="py-3 px-4">{courseMap.get(p.courseId)?.title || p.courseId}</td>
                    <td className="py-3 px-4">
                      {p.paymentMethod === 'PAYSTACK'
                        ? `Paystack${p.gatewayChannel ? ` (${p.gatewayChannel})` : ''}`
                        : 'Manual MoMo'}
                    </td>
                    <td className="py-3 px-4 font-mono">{p.senderPhone}</td>
                    <td className="py-3 px-4 font-mono font-semibold">{p.transactionId}</td>
                    <td className="py-3 px-4 font-mono tabular-nums">GH₵ {p.amountGhs.toFixed(2)}</td>
                    <td className="py-3 px-4">
                      <StatusIndicator status={p.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setInspectPayment(p);
                          setDecisionNote(p.adminNote || '');
                          setConfirmDriveApprovalModal(false);
                          setConfirmDriveShareOnApprove(
                            Boolean(getDriveAccessToken() && getCourseDriveTargets(p.courseId).hasDriveItems)
                          );
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Verify</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {pagedPayments.length} of {filteredPayments.length} records
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1 border border-slate-300 dark:border-slate-700 rounded disabled:opacity-40 cursor-pointer"
              >
                Prev
              </button>
              <span className="py-1 font-mono tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 border border-slate-300 dark:border-slate-700 rounded disabled:opacity-40 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GOOGLE DRIVE VIDEOS & STUDENT SHARING */}
      {activeTab === 'drive' && (
        <GoogleDrivePanel
          courses={data.courses}
          lessons={data.lessons}
          enrolments={data.enrolments}
          students={studentsList}
          onUpdated={() => {
            load();
            refreshBootstrap();
          }}
        />
      )}

      {/* 3. STUDENTS & INSTRUCTORS */}
      {(activeTab === 'students' || activeTab === 'instructors') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setErrorMsg('');
                try {
                  await apiFetch('/api/admin/users', {
                    method: 'POST',
                    body: JSON.stringify({
                      ...newUser,
                      role: activeTab === 'instructors' ? 'INSTRUCTOR' : 'STUDENT',
                    }),
                  });
                  setNewUser({ fullName: '', email: '', phone: '', password: '', role: 'INSTRUCTOR', title: '' });
                  setNotice('Account created with Email 2FA active.');
                  await Promise.all([load(), refreshBootstrap()]);
                } catch (err: any) {
                  setErrorMsg(err.message);
                }
              }}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
            >
              <h2 className="text-base font-bold">
                Add New {activeTab === 'instructors' ? 'Instructor' : 'Student'}
              </h2>
              <input
                type="text"
                required
                placeholder="Full Name"
                value={newUser.fullName}
                onChange={(e) => setNewUser({ ...newUser, fullName: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <input
                type="email"
                required
                placeholder="Email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={newUser.phone}
                onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <input
                type="text"
                placeholder="Title / Specialization"
                value={newUser.title}
                onChange={(e) => setNewUser({ ...newUser, title: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <input
                type="password"
                required
                minLength={8}
                placeholder="Strong Password (8+ chars, A-z, 0-9, !@#)"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <button
                type="submit"
                className="w-full py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
              >
                Create Account
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <h1 className="text-xl font-extrabold capitalize">{activeTab} Directory</h1>
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Email &amp; Phone</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(activeTab === 'instructors' ? instructorsList : studentsList).map((u) => (
                    <tr key={u.id}>
                      <td className="py-3 px-4">
                        <div className="font-semibold">{u.fullName}</div>
                        <div className="text-slate-500">{u.title}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div>{u.email}</div>
                        <div className="font-mono text-slate-500">{u.phone}</div>
                      </td>
                      <td className="py-3 px-4">
                        <StatusIndicator status={u.status} />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={async () => {
                            await apiFetch(`/api/admin/users/${u.id}`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }),
                            });
                            load();
                          }}
                          className="text-xs font-semibold text-[#EA580C] dark:text-orange-400 hover:underline cursor-pointer"
                        >
                          {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. COURSES MANAGEMENT */}
      {activeTab === 'courses' && (
        <div className="space-y-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiFetch('/api/courses', { method: 'POST', body: JSON.stringify(newCourse) });
              setNewCourse({ ...newCourse, title: '', summary: '' });
              setNotice('Course added.');
              await Promise.all([load(), refreshBootstrap()]);
            }}
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-1 md:grid-cols-6 gap-3 items-end"
          >
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1">Course Title</label>
              <input
                type="text"
                required
                value={newCourse.title}
                onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <select
                value={newCourse.categoryId}
                onChange={(e) => setNewCourse({ ...newCourse, categoryId: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Instructor</label>
              <select
                value={newCourse.instructorId}
                onChange={(e) => setNewCourse({ ...newCourse, instructorId: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                {instructorsList.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Price (GH₵)</label>
              <input
                type="number"
                min={0}
                value={newCourse.priceGhs}
                onChange={(e) => setNewCourse({ ...newCourse, priceGhs: Number(e.target.value), isFree: Number(e.target.value) === 0 })}
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <button type="submit" className="py-2 px-4 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer">
              Add Course
            </button>
            <div className="md:col-span-6">
              <input
                type="text"
                required
                placeholder="Course short summary..."
                value={newCourse.summary}
                onChange={(e) => setNewCourse({ ...newCourse, summary: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </form>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-500">
                <tr>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Assigned Instructor</th>
                  <th className="py-3 px-4">Fee</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.courses.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 px-4 font-semibold">{c.title}</td>
                    <td className="py-3 px-4">{catMap.get(c.categoryId)?.name}</td>
                    <td className="py-3 px-4">
                      <select
                        value={c.instructorId}
                        onChange={async (e) => {
                          await apiFetch(`/api/courses/${c.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ instructorId: e.target.value }),
                          });
                          await Promise.all([load(), refreshBootstrap()]);
                        }}
                        className="px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      >
                        {instructorsList.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.fullName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums">
                      {c.isFree ? 'Free' : `GH₵ ${c.priceGhs}`}
                    </td>
                    <td className="py-3 px-4">
                      {c.isPublished ? 'Published' : 'Draft'} · {c.isFeatured ? 'Featured' : 'Standard'}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/courses/${c.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ isPublished: !c.isPublished }),
                          });
                          await Promise.all([load(), refreshBootstrap()]);
                        }}
                        className="text-[#EA580C] dark:text-orange-400 hover:underline cursor-pointer"
                      >
                        {c.isPublished ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/courses/${c.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ isFeatured: !c.isFeatured }),
                          });
                          await Promise.all([load(), refreshBootstrap()]);
                        }}
                        className="text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
                      >
                        {c.isFeatured ? 'Unfeature' : 'Feature'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. CATEGORIES */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiFetch('/api/categories', { method: 'POST', body: JSON.stringify(newCategory) });
              setNewCategory({ name: '', description: '' });
              await Promise.all([load(), refreshBootstrap()]);
            }}
            className="lg:col-span-4 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 h-fit"
          >
            <h2 className="text-base font-bold">Create Category</h2>
            <input
              type="text"
              required
              placeholder="Category Name"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <textarea
              rows={2}
              placeholder="Description"
              value={newCategory.description}
              onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <button type="submit" className="w-full py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg">
              Add Category
            </button>
          </form>
          <div className="lg:col-span-8 space-y-2">
            {data.categories.map((cat) => (
              <div
                key={cat.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-sm">{cat.name}</div>
                  <div className="text-slate-500">{cat.description}</div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch(`/api/categories/${cat.id}`, { method: 'DELETE' });
                    await Promise.all([load(), refreshBootstrap()]);
                  }}
                  className="text-rose-600 hover:underline cursor-pointer"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. MODULES & LESSONS */}
      {(activeTab === 'modules' || activeTab === 'lessons') && (
        <div className="space-y-4">
          <h1 className="text-xl font-extrabold capitalize">All Academy {activeTab}</h1>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-500">
                <tr>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">{activeTab === 'lessons' ? 'Duration / PDF' : 'Order'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(activeTab === 'modules' ? data.modules : data.lessons).map((item: any) => (
                  <tr key={item.id}>
                    <td className="py-3 px-4 font-semibold">{item.title}</td>
                    <td className="py-3 px-4">{courseMap.get(item.courseId)?.title}</td>
                    <td className="py-3 px-4 font-mono">
                      {activeTab === 'lessons' ? `${item.durationMinutes}m · ${item.pdfTitle}` : `#${item.orderIndex}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. ENROLMENTS */}
      {activeTab === 'enrolments' && (
        <div className="space-y-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiFetch('/api/admin/enrolments', { method: 'POST', body: JSON.stringify(manualEnrol) });
              setNotice('Student enrolled.');
              load();
            }}
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap gap-3 items-end"
          >
            <div>
              <label className="block text-xs font-medium mb-1">Student</label>
              <select
                required
                value={manualEnrol.studentId}
                onChange={(e) => setManualEnrol({ ...manualEnrol, studentId: e.target.value })}
                className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">Select Student</option>
                {studentsList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Course</label>
              <select
                required
                value={manualEnrol.courseId}
                onChange={(e) => setManualEnrol({ ...manualEnrol, courseId: e.target.value })}
                className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">Select Course</option>
                {data.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg">
              Grant Enrolment
            </button>
          </form>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-500">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.enrolments.map((e) => (
                  <tr key={e.id}>
                    <td className="py-3 px-4 font-semibold">{userMap.get(e.studentId)?.fullName || e.studentId}</td>
                    <td className="py-3 px-4">{courseMap.get(e.courseId)?.title}</td>
                    <td className="py-3 px-4 font-mono tabular-nums">{e.progressPercent}%</td>
                    <td className="py-3 px-4">
                      <StatusIndicator status={e.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/admin/enrolments/${e.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: e.status === 'REVOKED' ? 'ACTIVE' : 'REVOKED' }),
                          });
                          load();
                        }}
                        className="text-[#EA580C] dark:text-orange-400 hover:underline cursor-pointer"
                      >
                        {e.status === 'REVOKED' ? 'Restore' : 'Revoke'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 8. ASSIGNMENTS & QUIZZES */}
      {activeTab === 'assignments' && (
        <div className="space-y-4">
          <h1 className="text-xl font-extrabold">All Assignments &amp; Submissions</h1>
          {data.assignments.map((a) => (
            <div
              key={a.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs space-y-1"
            >
              <div className="font-bold text-sm">{a.title}</div>
              <div className="text-slate-500">
                {courseMap.get(a.courseId)?.title} · Due {a.dueDate} · Submissions:{' '}
                {data.submissions.filter((s) => s.assignmentId === a.id).length}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'quizzes' && (
        <div className="space-y-4">
          <h1 className="text-xl font-extrabold">Academy Quizzes</h1>
          {data.quizzes.map((q) => (
            <div
              key={q.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
            >
              <div className="font-bold text-sm">{q.title}</div>
              <div className="text-slate-500">
                {courseMap.get(q.courseId)?.title} · {q.questions.length} Questions · Pass {q.passingScore}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 9. CERTIFICATES */}
      {activeTab === 'certificates' && (
        <div className="space-y-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiFetch('/api/admin/certificates/issue', { method: 'POST', body: JSON.stringify(manualEnrol) });
              setNotice('Official certificate issued.');
              load();
            }}
            className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap gap-3 items-end"
          >
            <select
              required
              value={manualEnrol.studentId}
              onChange={(e) => setManualEnrol({ ...manualEnrol, studentId: e.target.value })}
              className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              <option value="">Select Student</option>
              {studentsList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
            <select
              required
              value={manualEnrol.courseId}
              onChange={(e) => setManualEnrol({ ...manualEnrol, courseId: e.target.value })}
              className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              <option value="">Select Course</option>
              {data.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg">
              Issue Certificate
            </button>
          </form>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-500">
                <tr>
                  <th className="py-3 px-4">Credential ID</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Issued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.certificates.map((c) => (
                  <tr key={c.id}>
                    <td className="py-3 px-4 font-mono font-semibold text-[#EA580C] dark:text-orange-400">
                      {c.certificateNumber}
                    </td>
                    <td className="py-3 px-4">{c.studentName}</td>
                    <td className="py-3 px-4">{c.courseTitle}</td>
                    <td className="py-3 px-4 font-mono">{new Date(c.issuedAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 10. ANNOUNCEMENTS & NOTIFICATIONS */}
      {activeTab === 'announcements' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await apiFetch('/api/admin/announcements', { method: 'POST', body: JSON.stringify(newAnnouncement) });
              setNewAnnouncement({ title: '', message: '', audience: 'ALL' });
              setNotice('Announcement broadcast to selected audience.');
              load();
            }}
            className="lg:col-span-5 p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 h-fit"
          >
            <h2 className="text-base font-bold">Broadcast Announcement</h2>
            <input
              type="text"
              required
              placeholder="Announcement Headline"
              value={newAnnouncement.title}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <select
              value={newAnnouncement.audience}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, audience: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            >
              <option value="ALL">All Academy Users</option>
              <option value="STUDENTS">Students Only</option>
              <option value="INSTRUCTORS">Instructors Only</option>
            </select>
            <textarea
              rows={4}
              required
              placeholder="Announcement body..."
              value={newAnnouncement.message}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <button type="submit" className="w-full py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg">
              Send Broadcast
            </button>
          </form>
          <div className="lg:col-span-7 space-y-3">
            {data.announcements.map((a) => (
              <div
                key={a.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1 text-xs"
              >
                <div className="font-bold text-sm">{a.title}</div>
                <div className="text-[#EA580C] dark:text-orange-400">Audience: {a.audience}</div>
                <p className="text-slate-600 dark:text-slate-300">{a.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-extrabold">Administrator Notifications</h1>
            <button
              type="button"
              onClick={async () => {
                await apiFetch('/api/notifications/read-all', { method: 'POST' });
                load();
              }}
              className="text-xs text-[#EA580C] dark:text-orange-400 hover:underline cursor-pointer"
            >
              Mark all read
            </button>
          </div>
          {data.notifications.map((n) => (
            <div
              key={n.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
            >
              <div className="font-bold text-sm">{n.title}</div>
              <p className="text-slate-600 dark:text-slate-300 mt-1">{n.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* 11. SUPPORT MESSAGES */}
      {activeTab === 'messages' && (
        <div className="space-y-4">
          <h1 className="text-xl font-extrabold">Support Requests &amp; Inquiries</h1>
          {data.messages.map((m) => (
            <div
              key={m.id}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">
                  {m.subject} — {m.senderName} ({m.senderEmail})
                </span>
                <StatusIndicator status={m.status} />
              </div>
              <p className="text-slate-600 dark:text-slate-300">{m.body}</p>
              {m.replyBody && (
                <div className="p-3 rounded bg-slate-50 dark:bg-slate-800">
                  <span className="font-semibold">Reply:</span> {m.replyBody}
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  setReplyTarget(m);
                  setReplyBody(m.replyBody || '');
                }}
                className="text-[#EA580C] dark:text-orange-400 font-semibold hover:underline cursor-pointer"
              >
                Reply to Inquiry
              </button>
            </div>
          ))}
          {replyTarget && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch(`/api/admin/messages/${replyTarget.id}/reply`, {
                  method: 'POST',
                  body: JSON.stringify({ replyBody, status: 'REPLIED' }),
                });
                setReplyTarget(null);
                load();
              }}
              className="p-5 rounded-2xl border border-[#FCD5BA] dark:border-orange-800 bg-white dark:bg-slate-900 space-y-3"
            >
              <div className="text-sm font-bold">Reply to {replyTarget.senderName}</div>
              <textarea
                rows={3}
                required
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <div className="flex gap-2">
                <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg">
                  Send Reply
                </button>
                <button
                  type="button"
                  onClick={() => setReplyTarget(null)}
                  className="px-4 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* 12. REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-extrabold">Revenue &amp; Course Reports</h1>
            <button
              type="button"
              onClick={exportRevenueCsv}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Financial CSV</span>
            </button>
          </div>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-500">
                <tr>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Enrolments</th>
                  <th className="py-3 px-4">Verified Payments</th>
                  <th className="py-3 px-4">Verified Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.courses.map((c) => {
                  const approved = data.payments.filter((p) => p.courseId === c.id && p.status === 'APPROVED');
                  const rev = approved.reduce((s, p) => s + p.amountGhs, 0);
                  return (
                    <tr key={c.id}>
                      <td className="py-3 px-4 font-semibold">{c.title}</td>
                      <td className="py-3 px-4 font-mono tabular-nums">
                        {data.enrolments.filter((e) => e.courseId === c.id).length}
                      </td>
                      <td className="py-3 px-4 font-mono tabular-nums">{approved.length}</td>
                      <td className="py-3 px-4 font-mono tabular-nums font-bold">GH₵ {rev.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 13. WEBSITE MANAGEMENT */}
      {activeTab === 'website' && websiteDraft && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await apiFetch('/api/admin/website', { method: 'PATCH', body: JSON.stringify(websiteDraft) });
            setNotice('Public website content updated.');
            await Promise.all([load(), refreshBootstrap()]);
          }}
          className="max-w-2xl p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4"
        >
          <h1 className="text-xl font-extrabold">Website Content Management</h1>
          <div>
            <label className="block text-xs font-medium mb-1">Hero Headline</label>
            <input
              type="text"
              value={websiteDraft.heroHeadline}
              onChange={(e) => setWebsiteDraft({ ...websiteDraft, heroHeadline: e.target.value })}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Hero Subheadline</label>
            <textarea
              rows={3}
              value={websiteDraft.heroSubheadline}
              onChange={(e) => setWebsiteDraft({ ...websiteDraft, heroSubheadline: e.target.value })}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Top Announcement Banner</label>
            <input
              type="text"
              value={websiteDraft.announcementBanner}
              onChange={(e) => setWebsiteDraft({ ...websiteDraft, announcementBanner: e.target.value })}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Academy Mission Statement</label>
            <textarea
              rows={2}
              value={websiteDraft.aboutMission}
              onChange={(e) => setWebsiteDraft({ ...websiteDraft, aboutMission: e.target.value })}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <button type="submit" className="px-5 py-2.5 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg">
            Publish Website Changes
          </button>
        </form>
      )}

      {/* 14. SYSTEM SETTINGS */}
      {activeTab === 'settings' && settingsDraft && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await apiFetch('/api/admin/settings', { method: 'PATCH', body: JSON.stringify(settingsDraft) });
            setNotice('System settings saved.');
            await Promise.all([load(), refreshBootstrap()]);
          }}
          className="max-w-2xl p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4"
        >
          <h1 className="text-xl font-extrabold">System &amp; Payment Settings</h1>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">MoMo Business Name</label>
              <input
                type="text"
                value={settingsDraft.momoBusinessName}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, momoBusinessName: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">MTN Mobile Money Number</label>
              <input
                type="text"
                value={settingsDraft.momoNumber}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, momoNumber: e.target.value })}
                className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">WhatsApp Support Number</label>
              <input
                type="text"
                value={settingsDraft.whatsappNumber}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, whatsappNumber: e.target.value })}
                className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Payment Gateway Mode</label>
              <select
                value={settingsDraft.paymentGatewayMode}
                onChange={(e) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    paymentGatewayMode: e.target.value as 'BOTH' | 'PAYSTACK' | 'MANUAL_MOMO' | 'MOMO_API_READY',
                  })
                }
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="BOTH">Paystack Instant Checkout + Manual MTN MoMo</option>
                <option value="PAYSTACK">Paystack Instant Checkout Only</option>
                <option value="MANUAL_MOMO">Manual MTN MoMo Verification Only</option>
              </select>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2 text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="font-bold">Paystack Server Integration Status</span>
              {bootstrap?.paystackConfigured ? (
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  Configured (PAYSTACK_SECRET_KEY detected)
                </span>
              ) : (
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  Waiting for PAYSTACK_SECRET_KEY in server environment secrets
                </span>
              )}
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Add <span className="font-mono font-semibold">PAYSTACK_SECRET_KEY</span> (and optionally{' '}
              <span className="font-mono font-semibold">PAYSTACK_WEBHOOK_SECRET</span>) in your server environment
              variables. Paste this Webhook URL into your Paystack Dashboard (Settings → API Keys &amp; Webhooks):
            </p>
            <div className="px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-[11px] break-all">
              {typeof window !== 'undefined' ? `${window.location.origin}/api/payments/paystack/webhook` : '/api/payments/paystack/webhook'}
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={settingsDraft.allowPublicRegistration}
              onChange={(e) => setSettingsDraft({ ...settingsDraft, allowPublicRegistration: e.target.checked })}
            />
            <span>Allow Public Student Registration</span>
          </label>
          <button type="submit" className="px-5 py-2.5 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg">
            Save System Settings
          </button>
        </form>
      )}

      {/* 15. ADMINISTRATOR PROFILE */}
      {activeTab === 'profile' && (
        <div className="max-w-xl space-y-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setErrorMsg('');
              try {
                await apiFetch('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(profileForm) });
                await refreshUser();
                setProfileForm((p) => ({ ...p, newPassword: '' }));
                setNotice(
                  profileForm.newPassword
                    ? 'Administrator profile & password updated securely.'
                    : 'Administrator profile updated.'
                );
              } catch (err: any) {
                setErrorMsg(err.message);
              }
            }}
            className="p-6 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4"
          >
            <h1 className="text-xl font-extrabold">Administrator Profile</h1>
            <input
              type="text"
              placeholder="Full Name"
              value={profileForm.fullName}
              onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <input
              type="text"
              placeholder="Phone Number"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              className="w-full px-3.5 py-2 text-sm font-mono rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <div>
              <label className="block text-xs font-medium mb-1">
                New Strong Password (optional — 8+ chars, upper/lower/number/symbol)
              </label>
              <input
                type="password"
                minLength={8}
                placeholder="Leave blank to keep current password"
                value={profileForm.newPassword}
                onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <button type="submit" className="px-5 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer">
              Save Administrator Profile
            </button>
          </form>

          <div className="p-6 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
                <span>Email 2FA Active</span>
              </div>
              <h2 className="text-base font-bold">Two-Factor Authentication &amp; Active Sessions</h2>
              <p className="text-xs text-[#4B5563] dark:text-slate-400">
                2FA codes for Super Administrator access are verified via{' '}
                <span className="font-mono font-semibold">{user.email}</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await apiFetch('/api/auth/revoke-sessions', { method: 'POST' });
                await logout();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out All Devices</span>
            </button>
          </div>
        </div>
      )}

      {/* PAYMENT VERIFICATION INSPECTION MODAL */}
      {inspectPayment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="font-bold text-sm">Verify MTN Mobile Money Payment</div>
              <button
                type="button"
                onClick={() => setInspectPayment(null)}
                className="p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-800/70">
                <div>
                  <div className="text-slate-500">Student</div>
                  <div className="font-semibold">{inspectPayment.fullName}</div>
                </div>
                <div>
                  <div className="text-slate-500">Sign-Up Email (Video Access)</div>
                  <div className="font-mono font-semibold text-[#EA580C] dark:text-orange-400 break-all">
                    {inspectPayment.email}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Course</div>
                  <div className="font-semibold">{courseMap.get(inspectPayment.courseId)?.title}</div>
                </div>
                <div>
                  <div className="text-slate-500">Transaction ID</div>
                  <div className="font-mono font-bold text-[#EA580C] dark:text-orange-400">
                    {inspectPayment.transactionId}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Payment Method</div>
                  <div className="font-semibold">
                    {inspectPayment.paymentMethod === 'PAYSTACK'
                      ? `Paystack${inspectPayment.gatewayChannel ? ` (${inspectPayment.gatewayChannel})` : ''}`
                      : 'Manual MTN Mobile Money'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Amount &amp; Sender</div>
                  <div className="font-mono font-semibold">
                    GH₵ {inspectPayment.amountGhs} · {inspectPayment.senderPhone}
                  </div>
                </div>
              </div>

              {inspectPayment.studentReply && (
                <div className="p-3 rounded-xl border border-[#FCD5BA] dark:border-orange-900 bg-[#FFF7F0] dark:bg-orange-950/30">
                  <span className="font-semibold">Student Note:</span> {inspectPayment.studentReply}
                </div>
              )}

              {inspectPayment.screenshotDataUrl && (
                <div className="space-y-1">
                  <div className="font-semibold text-slate-500">Uploaded Payment Receipt</div>
                  <img
                    src={inspectPayment.screenshotDataUrl}
                    alt="Payment screenshot"
                    className="max-h-56 rounded-lg border border-slate-200 dark:border-slate-700 object-contain"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1">Administrator Verification Note</label>
                <textarea
                  rows={2}
                  placeholder="Enter confirmation note, rejection reason, or additional info request..."
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              {(() => {
                const targets = getCourseDriveTargets(inspectPayment.courseId);
                if (!targets.hasDriveItems) {
                  return (
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-slate-600 dark:text-slate-300">
                        No Google Drive folder is linked to this course yet.
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setInspectPayment(null);
                          setActiveTab('drive');
                        }}
                        className="font-semibold text-[#EA580C] dark:text-orange-400 hover:underline cursor-pointer"
                      >
                        Link Drive Folder →
                      </button>
                    </div>
                  );
                }
                if (!driveConnected) {
                  return (
                    <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 space-y-2.5">
                      <div className="text-amber-900 dark:text-amber-200">
                        <strong>Connect Google Drive to Auto-Share Videos:</strong> Course folder{' '}
                        <strong>{targets.folderName}</strong> is linked. Sign in with Google below so approving this
                        payment also grants Drive access to <span className="font-mono">{inspectPayment.email}</span> (or
                        approve now and batch-share later from the Google Drive Videos tab).
                      </div>
                      <GoogleSignInButton onClick={handleConnectDriveInline} loading={driveAuthLoading} />
                    </div>
                  );
                }
                return (
                  <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/60 dark:bg-emerald-950/30 space-y-2">
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmDriveShareOnApprove}
                        onChange={(e) => setConfirmDriveShareOnApprove(e.target.checked)}
                        className="mt-0.5"
                      />
                      <span>
                        <strong>Share Google Drive Access on Approval:</strong> Grant Reader permission on{' '}
                        <strong>
                          {targets.folderId
                            ? targets.folderName
                            : `${targets.lessonFileIds.length} synced lesson video(s)`}
                        </strong>{' '}
                        to <span className="font-mono">{inspectPayment.email}</span>.
                      </span>
                    </label>
                  </div>
                );
              })()}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  disabled={approvingDecision}
                  onClick={() => handlePaymentDecision(inspectPayment.id, 'REQUEST_INFO')}
                  className="px-3.5 py-2 font-semibold border border-amber-500 text-amber-700 dark:text-amber-300 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  Request Additional Info
                </button>
                <button
                  type="button"
                  disabled={approvingDecision}
                  onClick={() => handlePaymentDecision(inspectPayment.id, 'REJECT')}
                  className="inline-flex items-center gap-1 px-3.5 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject Payment</span>
                </button>
                <button
                  type="button"
                  disabled={approvingDecision}
                  onClick={() => {
                    const targets = getCourseDriveTargets(inspectPayment.courseId);
                    if (confirmDriveShareOnApprove && driveConnected && targets.hasDriveItems) {
                      setConfirmDriveApprovalModal(true);
                    } else {
                      handlePaymentDecision(inspectPayment.id, 'APPROVE', false);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-4 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {confirmDriveShareOnApprove &&
                    driveConnected &&
                    getCourseDriveTargets(inspectPayment.courseId).hasDriveItems
                      ? 'Approve & Share Google Drive...'
                      : 'Approve & Activate Enrolment'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXPLICIT GOOGLE DRIVE SHARE CONFIRMATION MODAL ON PAYMENT APPROVAL */}
      {inspectPayment && confirmDriveApprovalModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Google Drive Permission Share"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                Confirm Google Drive Permission Share
              </div>
              <button
                type="button"
                onClick={() => setConfirmDriveApprovalModal(false)}
                className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Approving payment <strong className="font-mono">{inspectPayment.transactionId}</strong> will update Google
              Drive permissions to grant <strong>Reader (view-only)</strong> access to:
            </p>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 space-y-1.5">
              <div>
                <span className="text-slate-500">Student Email:</span>{' '}
                <span className="font-mono font-semibold text-[#EA580C] dark:text-orange-400">
                  {inspectPayment.email}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Drive Resource:</span>{' '}
                <span className="font-semibold">
                  {getCourseDriveTargets(inspectPayment.courseId).folderId
                    ? getCourseDriveTargets(inspectPayment.courseId).folderName
                    : `${getCourseDriveTargets(inspectPayment.courseId).lessonFileIds.length} synced lesson video(s)`}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Connected Google Account:</span>{' '}
                <span className="font-mono">{driveEmail}</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                disabled={approvingDecision}
                onClick={() => setConfirmDriveApprovalModal(false)}
                className="px-4 py-2 font-semibold border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={approvingDecision}
                onClick={() => handlePaymentDecision(inspectPayment.id, 'APPROVE', true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{approvingDecision ? 'Sharing & Activating...' : 'Confirm & Approve + Share Drive'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
