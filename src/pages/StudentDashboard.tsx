import React, { useEffect, useState } from 'react';
import {
  Award,
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Compass,
  CreditCard,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  PlayCircle,
  RefreshCw,
  Settings,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useApp } from '../context/AppContext';
import { DashboardShell, type NavItem } from '../components/DashboardShell';
import {
  CertificateModal,
  CourseThumbnail,
  MoMoPaymentModal,
  PasswordInput,
  StatusIndicator,
} from '../components/UiPrimitives';
import { LearningRoom } from './LearningRoom';
import type {
  Announcement,
  Assignment,
  AssignmentSubmission,
  Certificate,
  Course,
  Enrolment,
  NotificationItem,
  Payment,
  Quiz,
  QuizAttempt,
  SupportMessage,
} from '../types';

interface StudentWorkspaceData {
  enrolments: Enrolment[];
  unlockedDriveFolders?: Record<string, { folderId: string; folderName?: string }>;
  payments: Payment[];
  assignments: Assignment[];
  submissions: AssignmentSubmission[];
  quizzes: Quiz[];
  quizAttempts: QuizAttempt[];
  certificates: Certificate[];
  notifications: NotificationItem[];
  messages: SupportMessage[];
  announcements: Announcement[];
}

export function StudentDashboard() {
  const { user, bootstrap, navigate, refreshUser, refreshBootstrap, theme, setThemeMode, logout } = useApp();
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [workspace, setWorkspace] = useState<StudentWorkspaceData | null>(null);
  const [activeRoomCourseId, setActiveRoomCourseId] = useState<string | null>(null);
  const [payCourse, setPayCourse] = useState<Course | null>(null);
  const [viewCert, setViewCert] = useState<Certificate | null>(null);
  const [paystackNotice, setPaystackNotice] = useState<string>('');

  // Assignment submission state
  const [submittingAsg, setSubmittingAsg] = useState<Assignment | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [projectUrl, setProjectUrl] = useState('');

  // Quiz runner state
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<number[]>([]);
  const [quizResult, setQuizResult] = useState<QuizAttempt | null>(null);

  // Payment reply state
  const [replyingPaymentId, setReplyingPaymentId] = useState<string | null>(null);
  const [paymentReplyText, setPaymentReplyText] = useState('');

  // Messaging state
  const [msgSubject, setMsgSubject] = useState('');
  const [msgBody, setMsgBody] = useState('');

  // Profile state
  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    location: user?.location || '',
    bio: user?.bio || '',
    newPassword: '',
  });
  const [profileStatus, setProfileStatus] = useState('');
  const [profileError, setProfileError] = useState('');

  const loadWorkspace = async () => {
    try {
      const data = await apiFetch<StudentWorkspaceData>('/api/student/workspace');
      setWorkspace(data);
    } catch {
      // handled
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const paystackRef = params.get('reference') || params.get('trxref');
    if (paystackRef) {
      apiFetch<{ verified: boolean; courseId?: string }>('/api/payments/paystack/verify', {
        method: 'POST',
        body: JSON.stringify({ reference: paystackRef }),
      })
        .then(async (res) => {
          setPaystackNotice(
            `Paystack payment verified (${paystackRef})! Your course lessons and Google Drive video folder are now unlocked.`
          );
          await Promise.all([loadWorkspace(), refreshBootstrap()]);
          if (res.courseId) {
            setActiveRoomCourseId(res.courseId);
            setActiveTab('learning-room');
          } else {
            setActiveTab('payments');
          }
        })
        .catch(() => {
          loadWorkspace();
        })
        .finally(() => {
          window.history.replaceState({}, '', window.location.pathname);
        });
      return;
    }

    loadWorkspace();
    if (roomParam) {
      setActiveRoomCourseId(roomParam);
      setActiveTab('learning-room');
    }
  }, [refreshBootstrap]);

  const hasPendingPayment = Boolean(workspace?.payments.some((p) => p.status === 'PENDING'));

  useEffect(() => {
    if (!hasPendingPayment) return;
    const timer = window.setInterval(() => {
      loadWorkspace();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [hasPendingPayment]);

  if (!workspace || !bootstrap || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF7] dark:bg-[#0D1117]">
        <div className="text-sm text-slate-500">Loading your student workspace...</div>
      </div>
    );
  }

  const coursesMap = new Map(bootstrap.courses.map((c) => [c.id, c]));
  const unreadCount = workspace.notifications.filter((n) => !n.isRead).length;

  const enrolledCourses = workspace.enrolments
    .map((e) => ({ enrolment: e, course: coursesMap.get(e.courseId) }))
    .filter((item): item is { enrolment: Enrolment; course: Course } => Boolean(item.course));

  const completedCount = workspace.enrolments.filter((e) => e.status === 'COMPLETED').length;
  const inProgressCount = workspace.enrolments.filter((e) => e.status === 'ACTIVE').length;
  const pendingAssignments = workspace.assignments.filter(
    (a) => !workspace.submissions.some((s) => s.assignmentId === a.id)
  );

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'my-courses', label: 'My Courses', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'browse', label: 'Browse Courses', icon: <Compass className="w-4 h-4" /> },
    { id: 'learning-room', label: 'Learning Room', icon: <PlayCircle className="w-4 h-4" /> },
    {
      id: 'assignments',
      label: 'Assignments',
      icon: <FileText className="w-4 h-4" />,
      badge: pendingAssignments.length,
    },
    { id: 'quizzes', label: 'Quizzes', icon: <ClipboardCheck className="w-4 h-4" /> },
    { id: 'certificates', label: 'My Certificates', icon: <Award className="w-4 h-4" /> },
    { id: 'payments', label: 'Payments', icon: <CreditCard className="w-4 h-4" /> },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <Bell className="w-4 h-4" />,
      badge: unreadCount,
    },
    { id: 'messages', label: 'Messages', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'profile', label: 'My Profile', icon: <UserIcon className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const openLearningRoom = (courseId: string) => {
    setActiveRoomCourseId(courseId);
    setActiveTab('learning-room');
  };

  const handleEnrolFree = async (course: Course) => {
    await apiFetch('/api/enrolments/free', {
      method: 'POST',
      body: JSON.stringify({ courseId: course.id }),
    });
    await loadWorkspace();
    openLearningRoom(course.id);
  };

  const handleAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingAsg) return;
    await apiFetch(`/api/assignments/${submittingAsg.id}/submit`, {
      method: 'POST',
      body: JSON.stringify({ submissionText, projectUrl }),
    });
    setSubmittingAsg(null);
    setSubmissionText('');
    setProjectUrl('');
    loadWorkspace();
  };

  const handleQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuiz) return;
    const res = await apiFetch<{ attempt: QuizAttempt }>(`/api/quizzes/${activeQuiz.id}/attempt`, {
      method: 'POST',
      body: JSON.stringify({ answers: quizAnswers }),
    });
    setQuizResult(res.attempt);
    loadWorkspace();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ subject: msgSubject, body: msgBody, recipientRole: 'ADMIN' }),
    });
    setMsgSubject('');
    setMsgBody('');
    loadWorkspace();
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileStatus('');
    setProfileError('');
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        body: JSON.stringify(profileForm),
      });
      await refreshUser();
      setProfileStatus(
        profileForm.newPassword
          ? 'Password and profile updated securely. Prior sessions have been rotated.'
          : 'Profile updated successfully.'
      );
      setProfileForm((p) => ({ ...p, newPassword: '' }));
    } catch (err: any) {
      setProfileError(err.message || 'Unable to update settings.');
    }
  };

  const handleRevokeAllSessions = async () => {
    setProfileError('');
    await apiFetch('/api/auth/revoke-sessions', { method: 'POST' });
    await logout();
  };

  return (
    <DashboardShell
      roleLabel="Student Portal"
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      unreadNotifications={unreadCount}
    >
      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="p-6 rounded-2xl bg-[#111827] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src={user.avatarUrl}
                alt={user.fullName}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-full object-cover object-top border-2 border-orange-400"
              />
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold">Welcome back, {user.fullName}</h1>
                <p className="text-xs sm:text-sm text-slate-300">
                  Continue your practical AI and technology training below.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className="px-4 py-2.5 text-xs font-semibold bg-[#EA580C] hover:bg-[#D44E07] text-white rounded-xl whitespace-nowrap cursor-pointer transition-colors"
            >
              Browse Courses
            </button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Enrolled Courses', value: enrolledCourses.length },
              { label: 'In Progress', value: inProgressCount },
              { label: 'Completed', value: completedCount },
              { label: 'Pending Assignments', value: pendingAssignments.length },
              { label: 'Quizzes Taken', value: workspace.quizAttempts.length },
            ].map((stat) => (
              <div
                key={stat.label}
                className="p-4 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900"
              >
                <div className="text-2xl font-extrabold font-mono tabular-nums text-[#111827] dark:text-white">
                  {stat.value}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Free Orientation Video (Accessible immediately on fresh login before payment) */}
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-6 rounded-xl overflow-hidden bg-black border border-slate-200 dark:border-slate-800">
              <video
                controls
                playsInline
                preload="metadata"
                src="/assets/aistudio/1__MUST_WATCH___72d89e86.mp4"
                className="w-full aspect-video bg-black"
              />
            </div>
            <div className="lg:col-span-6 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#EA580C] dark:text-orange-400">
                Free Orientation Video · Included With Every Fresh Account
              </div>
              <h2 className="text-xl font-extrabold text-[#111827] dark:text-white">
                1) MUST WATCH!! Academy Orientation &amp; First Lesson
              </h2>
              <p className="text-xs sm:text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                Every student receives immediate free access to this single orientation video upon signing in. To unlock
                all remaining premium course videos in Instructor Emmanuel Sansah&apos;s Google Drive library, complete
                your <strong>GH₵ 50</strong> MTN Mobile Money payment to{' '}
                <span className="font-mono font-semibold text-[#EA580C] dark:text-orange-400">
                  {bootstrap.settings.momoNumber}
                </span>{' '}
                and access will be granted to your sign-up email (<span className="font-mono">{user.email}</span>).
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {bootstrap.courses.slice(0, 2).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openLearningRoom(c.id)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer transition-colors"
                  >
                    <PlayCircle className="w-3.5 h-3.5" />
                    <span>Open {c.title.split(' ')[0]} {c.title.split(' ')[1]} (GH₵ {c.priceGhs})</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <h2 className="text-base font-bold">Continue Learning</h2>
              {enrolledCourses.length === 0 ? (
                <div className="p-6 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <p className="text-sm text-[#4B5563] dark:text-slate-300">
                    Only Lesson 1 is free right now. Pay GH₵ 50 via MTN Mobile Money ({bootstrap.settings.momoNumber}) to
                    unlock full video access on your sign-up email ({user.email}).
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('browse')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer transition-colors"
                  >
                    Explore Available Courses
                  </button>
                </div>
              ) : (
                enrolledCourses.map(({ enrolment, course }) => {
                  const unlockedDrive = workspace.unlockedDriveFolders?.[course.id];
                  const driveFolderId = unlockedDrive?.folderId || course.driveFolderId;
                  return (
                    <div
                      key={course.id}
                      className="p-5 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="text-xs font-medium text-[#EA580C] dark:text-orange-400">
                          {enrolment.status} · {enrolment.progressPercent}% Complete
                        </div>
                        <h3 className="text-base font-bold">{course.title}</h3>
                        {driveFolderId && (
                          <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                            {enrolment.driveAccessEmail
                              ? `Google Drive Shared (${enrolment.driveAccessEmail})`
                              : 'Google Drive Tutorials Unlocked'}
                          </div>
                        )}
                        <div className="w-full max-w-md h-1.5 bg-[#EFE7DF] dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#EA580C] dark:bg-orange-400"
                            style={{ width: `${enrolment.progressPercent}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {driveFolderId && (
                          <a
                            href={`https://drive.google.com/drive/folders/${driveFolderId}?usp=drive_link`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl whitespace-nowrap"
                          >
                            <span>Open Drive Videos</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => openLearningRoom(course.id)}
                          className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl whitespace-nowrap cursor-pointer transition-colors"
                        >
                          Continue Lesson
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="lg:col-span-5 space-y-4">
              <h2 className="text-base font-bold">Upcoming Live Classes &amp; Notices</h2>
              <div className="space-y-3">
                {workspace.announcements.map((ann) => (
                  <div
                    key={ann.id}
                    className="p-4 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1"
                  >
                    <div className="text-xs font-semibold text-[#EA580C] dark:text-orange-400">{ann.title}</div>
                    <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">{ann.message}</p>
                  </div>
                ))}
                {workspace.notifications.slice(0, 3).map((n) => (
                  <div
                    key={n.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-1"
                  >
                    <div className="text-xs font-semibold">{n.title}</div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{n.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MY COURSES */}
      {activeTab === 'my-courses' && (
        <div className="space-y-6">
          <h1 className="text-xl font-extrabold">My Enrolled Courses</h1>
          {enrolledCourses.length === 0 ? (
            <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-500">
              No active enrolments yet. Visit Browse Courses to enrol.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {enrolledCourses.map(({ enrolment, course }) => {
                const unlockedDrive = workspace.unlockedDriveFolders?.[course.id];
                const driveFolderId = unlockedDrive?.folderId || course.driveFolderId;
                return (
                  <div
                    key={course.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col"
                  >
                    <div className="aspect-[16/9]">
                      <CourseThumbnail
                        src={course.thumbnailUrl}
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                      <div className="space-y-2">
                        <StatusIndicator status={enrolment.status} />
                        <h3 className="text-base font-bold">{course.title}</h3>
                        <div className="text-xs font-mono tabular-nums text-slate-500">
                          Progress: {enrolment.progressPercent}%
                        </div>
                        {driveFolderId && (
                          <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                            {enrolment.driveAccessEmail
                              ? `Drive Access Active (${enrolment.driveAccessEmail})`
                              : 'Google Drive Tutorials Unlocked'}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {driveFolderId && (
                          <a
                            href={`https://drive.google.com/drive/folders/${driveFolderId}?usp=drive_link`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl flex items-center justify-center gap-1.5"
                          >
                            <span>Open Course Google Drive</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => openLearningRoom(course.id)}
                          className="w-full py-2.5 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer transition-colors"
                        >
                          Open Learning Room
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* BROWSE COURSES */}
      {activeTab === 'browse' && (
        <div className="space-y-6">
          <h1 className="text-xl font-extrabold">Browse Academy Courses</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bootstrap.courses.map((course) => {
              const isEnrolled = workspace.enrolments.some((e) => e.courseId === course.id);
              const pendingPay = workspace.payments.find(
                (p) => p.courseId === course.id && p.status === 'PENDING'
              );
              return (
                <div
                  key={course.id}
                  className="rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col"
                >
                  <div className="aspect-[16/9]">
                    <CourseThumbnail
                      src={course.thumbnailUrl}
                      alt={course.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <div className="text-xs text-slate-500">
                        {course.duration} · {course.difficulty}
                      </div>
                      <h3 className="text-base font-bold">{course.title}</h3>
                      <p className="text-xs text-[#4B5563] dark:text-slate-300 line-clamp-2">{course.summary}</p>
                    </div>
                    <div className="pt-3 border-t border-[#EFE7DF] dark:border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono tabular-nums font-bold text-sm">
                          {course.isFree || course.priceGhs === 0 ? 'Free' : `GH₵ ${course.priceGhs}`}
                        </span>
                        {isEnrolled ? (
                          <button
                            type="button"
                            onClick={() => openLearningRoom(course.id)}
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-xl cursor-pointer"
                          >
                            Enter Room
                          </button>
                        ) : pendingPay ? (
                          <span className="text-xs font-semibold text-amber-600">MoMo Pending</span>
                        ) : course.isFree || course.priceGhs === 0 ? (
                          <button
                            type="button"
                            onClick={() => handleEnrolFree(course)}
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer"
                          >
                            Enrol Free
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPayCourse(course)}
                            className="px-3.5 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer"
                          >
                            Pay GH₵ {course.priceGhs} (MoMo)
                          </button>
                        )}
                      </div>
                      {!isEnrolled && !course.isFree && course.priceGhs > 0 && (
                        <button
                          type="button"
                          onClick={() => openLearningRoom(course.id)}
                          className="w-full py-1.5 text-xs font-semibold text-[#EA580C] dark:text-orange-400 border border-[#FCD5BA] dark:border-slate-700 hover:bg-[#FFF7F0] dark:hover:bg-slate-800 rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                          <span>Watch Lesson 1 Free (Rest Locked)</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LEARNING ROOM */}
      {activeTab === 'learning-room' && (
        <div>
          {activeRoomCourseId ? (
            <LearningRoom
              courseId={activeRoomCourseId}
              onBack={() => {
                setActiveRoomCourseId(null);
                setActiveTab('my-courses');
              }}
              onProgressUpdated={loadWorkspace}
            />
          ) : enrolledCourses.length > 0 ? (
            <div className="space-y-4">
              <h1 className="text-xl font-extrabold">Select a Course to Enter Learning Room</h1>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {enrolledCourses.map(({ course, enrolment }) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => setActiveRoomCourseId(course.id)}
                    className="p-5 text-left rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#EA580C] cursor-pointer space-y-1"
                  >
                    <div className="text-xs font-mono text-[#EA580C] dark:text-orange-400">
                      {enrolment.progressPercent}% Complete
                    </div>
                    <div className="font-bold">{course.title}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1">
                <h1 className="text-xl font-extrabold">Free Lesson 1 Preview Rooms</h1>
                <p className="text-xs text-slate-500">
                  Watch Lesson 1 free in any course below. Remaining videos require GH₵ 50 payment verification on your
                  sign-up email ({user.email}).
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bootstrap.courses.slice(0, 4).map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => setActiveRoomCourseId(course.id)}
                    className="p-5 text-left rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-[#EA580C] cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-mono text-[#EA580C] dark:text-orange-400">
                      <span>Lesson 1 Free · Rest Locked</span>
                      <span className="inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        GH₵ {course.priceGhs}
                      </span>
                    </div>
                    <div className="font-bold">{course.title}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ASSIGNMENTS */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          <h1 className="text-xl font-extrabold">Practical Assignments &amp; Projects</h1>
          {workspace.assignments.length === 0 ? (
            <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-500">
              No assignments published for your enrolled courses yet.
            </div>
          ) : (
            <div className="space-y-4">
              {workspace.assignments.map((asg) => {
                const sub = workspace.submissions.find((s) => s.assignmentId === asg.id);
                const course = coursesMap.get(asg.courseId);
                return (
                  <div
                    key={asg.id}
                    className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-[#EA580C] dark:text-orange-400 font-medium">
                          {course?.title} · Due {asg.dueDate} · Max Score {asg.maxScore}
                        </div>
                        <h3 className="text-base font-bold mt-1">{asg.title}</h3>
                      </div>
                      {sub ? (
                        <StatusIndicator status={sub.status} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSubmittingAsg(asg)}
                          className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
                        >
                          Submit Project
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{asg.instructions}</p>

                    {sub && (
                      <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                        <div className="font-semibold">Your Submission:</div>
                        <p className="text-slate-600 dark:text-slate-300">{sub.submissionText}</p>
                        {sub.projectUrl && (
                          <div className="font-mono text-[#EA580C] dark:text-orange-400">{sub.projectUrl}</div>
                        )}
                        {sub.status === 'GRADED' && (
                          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                            <span className="font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                              Grade: {sub.score} / {asg.maxScore}
                            </span>
                            {sub.feedback && (
                              <p className="mt-1 text-slate-700 dark:text-slate-200">
                                Instructor Feedback: {sub.feedback}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {submittingAsg && (
            <form
              onSubmit={handleAssignmentSubmit}
              className="p-6 rounded-2xl border border-[#FCD5BA] dark:border-orange-800 bg-white dark:bg-slate-900 space-y-4"
            >
              <h3 className="text-base font-bold">Submit: {submittingAsg.title}</h3>
              <div>
                <label className="block text-xs font-medium mb-1">Project Summary / Notes *</label>
                <textarea
                  rows={4}
                  required
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Project Link / GitHub / Video URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={projectUrl}
                  onChange={(e) => setProjectUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
                >
                  Submit Assignment
                </button>
                <button
                  type="button"
                  onClick={() => setSubmittingAsg(null)}
                  className="px-4 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* QUIZZES */}
      {activeTab === 'quizzes' && (
        <div className="space-y-6">
          <h1 className="text-xl font-extrabold">Quizzes &amp; Results</h1>

          {activeQuiz ? (
            <form
              onSubmit={handleQuizSubmit}
              className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold">{activeQuiz.title}</h2>
                  <p className="text-xs text-slate-500">Passing score: {activeQuiz.passingScore}%</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveQuiz(null);
                    setQuizResult(null);
                  }}
                  className="text-xs text-slate-500 hover:underline cursor-pointer"
                >
                  Back to Quizzes
                </button>
              </div>

              {quizResult ? (
                <div className="p-5 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-2">
                  <div className="text-lg font-bold font-mono tabular-nums">
                    Score: {quizResult.scorePercent}% ({quizResult.passed ? 'PASSED' : 'TRY AGAIN'})
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveQuiz(null);
                      setQuizResult(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {activeQuiz.questions.map((q, qIdx) => (
                    <div key={q.id} className="space-y-2">
                      <div className="text-sm font-semibold">
                        {qIdx + 1}. {q.prompt}
                      </div>
                      <div className="space-y-1.5">
                        {q.options.map((opt, oIdx) => (
                          <label
                            key={oIdx}
                            className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              checked={quizAnswers[qIdx] === oIdx}
                              onChange={() => {
                                const next = [...quizAnswers];
                                next[qIdx] = oIdx;
                                setQuizAnswers(next);
                              }}
                              required
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button
                    type="submit"
                    className="px-5 py-2.5 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
                  >
                    Submit Quiz Answers
                  </button>
                </>
              )}
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workspace.quizzes.map((q) => {
                const attempts = workspace.quizAttempts.filter((a) => a.quizId === q.id);
                const best = attempts.reduce((max, a) => Math.max(max, a.scorePercent), 0);
                return (
                  <div
                    key={q.id}
                    className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
                  >
                    <div className="text-xs text-[#EA580C] dark:text-orange-400 font-medium">
                      {coursesMap.get(q.courseId)?.title} · {q.questions.length} Questions
                    </div>
                    <h3 className="text-base font-bold">{q.title}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300">{q.description}</p>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-xs font-mono tabular-nums text-slate-500">
                        {attempts.length > 0 ? `Best Score: ${best}%` : 'Not attempted'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveQuiz(q);
                          setQuizAnswers(new Array(q.questions.length).fill(-1));
                          setQuizResult(null);
                        }}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
                      >
                        Start Quiz
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CERTIFICATES */}
      {activeTab === 'certificates' && (
        <div className="space-y-6">
          <h1 className="text-xl font-extrabold">My Certificates</h1>
          {workspace.certificates.length === 0 ? (
            <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm text-slate-500">
              Complete 100% of a course&apos;s lessons to earn your official EK TECH SOLUTIONS certificate.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {workspace.certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-mono text-[#EA580C] dark:text-orange-400">
                      {cert.certificateNumber}
                    </div>
                    <h3 className="text-base font-bold">{cert.courseTitle}</h3>
                    <div className="text-xs text-slate-500">
                      Issued {new Date(cert.issuedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setViewCert(cert)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg whitespace-nowrap cursor-pointer"
                  >
                    Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PAYMENTS */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-extrabold">Course Payments (Paystack &amp; MTN MoMo)</h1>
              <p className="text-xs text-slate-500">
                Pay online instantly via Paystack (Card / MoMo) or transfer to {bootstrap.settings.momoBusinessName} (
                {bootstrap.settings.momoNumber}) for manual admin verification.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadWorkspace()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Status</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('browse')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
              >
                Enrol in Another Course
              </button>
            </div>
          </div>

          {paystackNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs font-medium text-emerald-800 dark:text-emerald-200">
              {paystackNotice}
            </div>
          )}

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-500">
                <tr>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Method</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Reference / TxID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Admin Note / Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {workspace.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 font-medium">{coursesMap.get(p.courseId)?.title || p.courseId}</td>
                    <td className="py-3 px-4">
                      {p.paymentMethod === 'PAYSTACK'
                        ? `Paystack${p.gatewayChannel ? ` (${p.gatewayChannel})` : ''}`
                        : 'Manual MoMo'}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums">GH₵ {p.amountGhs.toFixed(2)}</td>
                    <td className="py-3 px-4 font-mono">{p.transactionId}</td>
                    <td className="py-3 px-4 font-mono tabular-nums">{p.paymentDate}</td>
                    <td className="py-3 px-4">
                      <StatusIndicator status={p.status} />
                    </td>
                    <td className="py-3 px-4 space-y-1">
                      {p.adminNote && <div className="text-slate-600 dark:text-slate-300">{p.adminNote}</div>}
                      {p.status === 'PENDING' && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingPaymentId(p.id);
                              setPaymentReplyText(p.studentReply || '');
                            }}
                            className="text-[#EA580C] dark:text-orange-400 hover:underline cursor-pointer"
                          >
                            Add Note
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await apiFetch(`/api/payments/${p.id}/cancel`, { method: 'POST' });
                              loadWorkspace();
                            }}
                            className="text-rose-600 hover:underline cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {replyingPaymentId && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch(`/api/payments/${replyingPaymentId}/reply`, {
                  method: 'POST',
                  body: JSON.stringify({ studentReply: paymentReplyText }),
                });
                setReplyingPaymentId(null);
                loadWorkspace();
              }}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
            >
              <div className="text-xs font-bold">Reply to Administrator Verification Request</div>
              <input
                type="text"
                required
                placeholder="Provide additional verification details..."
                value={paymentReplyText}
                onChange={(e) => setPaymentReplyText(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
                >
                  Send Update
                </button>
                <button
                  type="button"
                  onClick={() => setReplyingPaymentId(null)}
                  className="px-4 py-1.5 text-xs border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-extrabold">Notifications</h1>
            <button
              type="button"
              onClick={async () => {
                await apiFetch('/api/notifications/read-all', { method: 'POST' });
                loadWorkspace();
              }}
              className="text-xs font-semibold text-[#EA580C] dark:text-orange-400 hover:underline cursor-pointer"
            >
              Mark all as read
            </button>
          </div>
          <div className="space-y-3">
            {workspace.notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 rounded-xl border bg-white dark:bg-slate-900 flex items-start justify-between gap-4 ${
                  n.isRead
                    ? 'border-slate-200 dark:border-slate-800 opacity-80'
                    : 'border-[#FCD5BA] dark:border-orange-700'
                }`}
              >
                <div className="space-y-1">
                  <div className="text-sm font-bold">{n.title}</div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{n.message}</p>
                  <div className="text-[11px] text-slate-400 font-mono">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
                {!n.isRead && (
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/notifications/${n.id}/read`, { method: 'POST' });
                      loadWorkspace();
                    }}
                    className="text-xs text-[#EA580C] dark:text-orange-400 whitespace-nowrap cursor-pointer"
                  >
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MESSAGES */}
      {activeTab === 'messages' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <form
              onSubmit={handleSendMessage}
              className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4"
            >
              <h2 className="text-base font-bold">Contact Academy Support</h2>
              <input
                type="text"
                required
                placeholder="Subject"
                value={msgSubject}
                onChange={(e) => setMsgSubject(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <textarea
                rows={4}
                required
                placeholder="Write your question or support request..."
                value={msgBody}
                onChange={(e) => setMsgBody(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
              >
                Send Message
              </button>
            </form>
          </div>
          <div className="lg:col-span-7 space-y-3">
            <h2 className="text-base font-bold">Message History</h2>
            {workspace.messages.map((m) => (
              <div
                key={m.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{m.subject}</span>
                  <StatusIndicator status={m.status} />
                </div>
                <p className="text-slate-600 dark:text-slate-300">{m.body}</p>
                {m.replyBody && (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <span className="font-semibold">Academy Reply:</span> {m.replyBody}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PROFILE */}
      {activeTab === 'profile' && (
        <form
          onSubmit={handleSaveProfile}
          className="max-w-xl p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4"
        >
          <h1 className="text-xl font-extrabold">My Profile</h1>
          {profileStatus && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-300">
              {profileStatus}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1">Full Name</label>
            <input
              type="text"
              value={profileForm.fullName}
              onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">Phone Number</label>
              <input
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="w-full px-3.5 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Location</label>
              <input
                type="text"
                value={profileForm.location}
                onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Bio</label>
            <textarea
              rows={3}
              value={profileForm.bio}
              onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
          >
            Save Profile Changes
          </button>
        </form>
      )}

      {/* SETTINGS */}
      {activeTab === 'settings' && (
        <div className="max-w-xl space-y-6">
          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <h1 className="text-xl font-extrabold">Workspace Settings</h1>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Appearance Mode</div>
                <div className="text-xs text-slate-500">Switch between Light and Dark interface</div>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                    theme === 'light' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md cursor-pointer ${
                    theme === 'dark' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSaveProfile}
            className="p-6 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
          >
            <h2 className="text-base font-bold">Change Account Password</h2>
            <p className="text-xs text-[#4B5563] dark:text-slate-400">
              Minimum 8 characters with uppercase, lowercase, number, and symbol. Changing your password rotates all active session tokens.
            </p>
            {profileError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300">
                {profileError}
              </div>
            )}
            {profileStatus && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-700 dark:text-emerald-300">
                {profileStatus}
              </div>
            )}
            <PasswordInput
              minLength={8}
              required
              placeholder="New strong password (e.g. Secure@2026!)"
              value={profileForm.newPassword}
              onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer"
            >
              Update Password
            </button>
          </form>

          <div className="p-6 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Email 2FA Active</span>
                </div>
                <h2 className="text-base font-bold">Two-Factor Authentication &amp; Active Sessions</h2>
                <p className="text-xs text-[#4B5563] dark:text-slate-400">
                  Every login and password reset sends a 6-digit verification code to{' '}
                  <span className="font-mono font-semibold">{user.email}</span>. Use the button below to invalidate all
                  signed-in browsers immediately.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRevokeAllSessions}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out All Devices</span>
            </button>
          </div>
        </div>
      )}

      {payCourse && (
        <MoMoPaymentModal
          course={payCourse}
          onClose={() => setPayCourse(null)}
          onSuccess={() => loadWorkspace()}
        />
      )}
      {viewCert && <CertificateModal certificate={viewCert} onClose={() => setViewCert(null)} />}
    </DashboardShell>
  );
}
