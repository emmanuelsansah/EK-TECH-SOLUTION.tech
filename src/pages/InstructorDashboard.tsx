import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Bell,
  BookOpen,
  ClipboardCheck,
  FileText,
  Layers,
  LayoutDashboard,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  User as UserIcon,
  Users,
  Video,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useApp } from '../context/AppContext';
import { DashboardShell, type NavItem } from '../components/DashboardShell';
import { GoogleDrivePanel } from '../components/GoogleDrivePanel';
import { PasswordInput, StatusIndicator } from '../components/UiPrimitives';
import type {
  Assignment,
  AssignmentSubmission,
  Category,
  Course,
  Enrolment,
  Lesson,
  Module,
  NotificationItem,
  Quiz,
  QuizAttempt,
  User,
} from '../types';

interface InstructorWorkspace {
  courses: Course[];
  categories: Category[];
  modules: Module[];
  lessons: Lesson[];
  enrolments: Enrolment[];
  assignments: Assignment[];
  submissions: AssignmentSubmission[];
  quizzes: Quiz[];
  quizAttempts: QuizAttempt[];
  students: User[];
  notifications: NotificationItem[];
}

export function InstructorDashboard() {
  const { user, refreshBootstrap, refreshUser, logout } = useApp();
  const [activeTab, setActiveTab] = useState('overview');
  const [ws, setWs] = useState<InstructorWorkspace | null>(null);

  // Course creation form
  const [newCourse, setNewCourse] = useState({
    title: '',
    categoryId: 'cat-1',
    summary: '',
    description: '',
    priceGhs: 50,
    isFree: false,
    duration: '4 Weeks',
    difficulty: 'Beginner',
  });

  // Curriculum builder state
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [newModTitle, setNewModTitle] = useState('');
  const [newModDesc, setNewModDesc] = useState('');
  const [newLesson, setNewLesson] = useState({
    moduleId: '',
    title: '',
    description: '',
    videoUrl: '',
    durationMinutes: 20,
    pdfTitle: '',
    pdfSummary: '',
    practicalExercise: '',
  });

  // Assignment builder & grading
  const [newAsg, setNewAsg] = useState({ courseId: '', title: '', instructions: '', dueDate: '2026-12-15', maxScore: 100 });
  const [gradingSub, setGradingSub] = useState<AssignmentSubmission | null>(null);
  const [gradeScore, setGradeScore] = useState(90);
  const [gradeFeedback, setGradeFeedback] = useState('');

  // Quiz builder
  const [newQuiz, setNewQuiz] = useState({
    courseId: '',
    title: '',
    description: '',
    passingScore: 70,
    prompt: '',
    opt0: '',
    opt1: '',
    opt2: '',
    correctIndex: 0,
  });

  const [profileForm, setProfileForm] = useState({
    fullName: user?.fullName || '',
    title: user?.title || '',
    bio: user?.bio || '',
    phone: user?.phone || '',
    newPassword: '',
  });
  const [profileError, setProfileError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    const data = await apiFetch<InstructorWorkspace>('/api/instructor/workspace');
    setWs(data);
    if (!selectedCourseId && data.courses[0]) {
      setSelectedCourseId(data.courses[0].id);
    }
    if (!newAsg.courseId && data.courses[0]) {
      setNewAsg((a) => ({ ...a, courseId: data.courses[0].id }));
    }
    if (!newQuiz.courseId && data.courses[0]) {
      setNewQuiz((q) => ({ ...q, courseId: data.courses[0].id }));
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (!ws || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF7] dark:bg-[#0D1117]">
        <div className="text-sm text-slate-500">Loading instructor portal...</div>
      </div>
    );
  }

  const pendingGrades = ws.submissions.filter((s) => s.status === 'SUBMITTED').length;
  const unreadNotifs = ws.notifications.filter((n) => !n.isRead).length;
  const studentMap = new Map(ws.students.map((s) => [s.id, s]));
  const courseMap = new Map(ws.courses.map((c) => [c.id, c]));

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'drive', label: 'Google Drive Videos', icon: <Video className="w-4 h-4" /> },
    { id: 'courses', label: 'Assigned Courses', icon: <BookOpen className="w-4 h-4" /> },
    { id: 'curriculum', label: 'Modules & Lessons', icon: <Layers className="w-4 h-4" /> },
    { id: 'assignments', label: 'Assignments & Grading', icon: <FileText className="w-4 h-4" />, badge: pendingGrades },
    { id: 'quizzes', label: 'Quizzes', icon: <ClipboardCheck className="w-4 h-4" /> },
    { id: 'students', label: 'Enrolled Students', icon: <Users className="w-4 h-4" /> },
    { id: 'analytics', label: 'Course Analytics', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" />, badge: unreadNotifs },
    { id: 'profile', label: 'Instructor Profile', icon: <UserIcon className="w-4 h-4" /> },
  ];

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    await apiFetch('/api/courses', {
      method: 'POST',
      body: JSON.stringify(newCourse),
    });
    setNewCourse({
      title: '',
      categoryId: ws.categories[0]?.id || 'cat-1',
      summary: '',
      description: '',
      priceGhs: 50,
      isFree: false,
      duration: '4 Weeks',
      difficulty: 'Beginner',
    });
    setNotice('Course created successfully.');
    await Promise.all([load(), refreshBootstrap()]);
  };

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourseId) return;
    await apiFetch(`/api/courses/${selectedCourseId}/modules`, {
      method: 'POST',
      body: JSON.stringify({ title: newModTitle, description: newModDesc }),
    });
    setNewModTitle('');
    setNewModDesc('');
    load();
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    const modId = newLesson.moduleId || ws.modules.find((m) => m.courseId === selectedCourseId)?.id;
    if (!modId) return;
    await apiFetch(`/api/modules/${modId}/lessons`, {
      method: 'POST',
      body: JSON.stringify(newLesson),
    });
    setNewLesson({
      moduleId: modId,
      title: '',
      description: '',
      videoUrl: '',
      durationMinutes: 20,
      pdfTitle: '',
      pdfSummary: '',
      practicalExercise: '',
    });
    load();
  };

  return (
    <DashboardShell
      roleLabel="Instructor Portal"
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
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

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#111827] text-white">
            <h1 className="text-xl font-extrabold">Instructor Studio — {user.fullName}</h1>
            <p className="text-xs text-slate-300 mt-1">{user.title}</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Assigned Courses', value: ws.courses.length },
              { label: 'Total Lessons', value: ws.lessons.length },
              { label: 'Enrolled Students', value: ws.enrolments.length },
              { label: 'Pending Grading', value: pendingGrades },
            ].map((s) => (
              <div
                key={s.label}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
              >
                <div className="text-2xl font-extrabold font-mono tabular-nums">{s.value}</div>
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'drive' && (
        <GoogleDrivePanel
          courses={ws.courses}
          lessons={ws.lessons}
          enrolments={ws.enrolments}
          students={ws.students}
          onUpdated={() => {
            load();
            refreshBootstrap();
          }}
        />
      )}

      {activeTab === 'courses' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <form
              onSubmit={handleCreateCourse}
              className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4"
            >
              <h2 className="text-base font-bold">Create New Course</h2>
              <input
                type="text"
                required
                placeholder="Course Title"
                value={newCourse.title}
                onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <select
                value={newCourse.categoryId}
                onChange={(e) => setNewCourse({ ...newCourse, categoryId: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                {ws.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <textarea
                rows={2}
                required
                placeholder="Short Summary"
                value={newCourse.summary}
                onChange={(e) => setNewCourse({ ...newCourse, summary: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Duration (e.g. 6 Weeks)"
                  value={newCourse.duration}
                  onChange={(e) => setNewCourse({ ...newCourse, duration: e.target.value })}
                  className="px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <select
                  value={newCourse.difficulty}
                  onChange={(e) => setNewCourse({ ...newCourse, difficulty: e.target.value })}
                  className="px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="Beginner">Beginner</option>
                  <option value="Intermediate">Intermediate</option>
                  <option value="Advanced">Advanced</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={newCourse.isFree}
                    onChange={(e) => setNewCourse({ ...newCourse, isFree: e.target.checked })}
                  />
                  <span>Free Course</span>
                </label>
                {!newCourse.isFree && (
                  <input
                    type="number"
                    min={0}
                    value={newCourse.priceGhs}
                    onChange={(e) => setNewCourse({ ...newCourse, priceGhs: Number(e.target.value) })}
                    className="w-32 px-3 py-1.5 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                )}
              </div>
              <button
                type="submit"
                className="w-full py-2.5 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
              >
                Create &amp; Publish Course
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-base font-bold">My Assigned Courses ({ws.courses.length})</h2>
            {ws.courses.map((c) => (
              <div
                key={c.id}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="text-xs text-[#EA580C] dark:text-orange-400 font-medium">
                    {c.isPublished ? 'Published' : 'Draft'} · {c.isFree ? 'Free' : `GH₵ ${c.priceGhs}`}
                  </div>
                  <div className="font-bold text-sm">{c.title}</div>
                  <div className="text-xs text-slate-500">
                    {ws.modules.filter((m) => m.courseId === c.id).length} Modules ·{' '}
                    {ws.lessons.filter((l) => l.courseId === c.id).length} Lessons
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCourseId(c.id);
                      setActiveTab('curriculum');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                  >
                    Curriculum
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/api/courses/${c.id}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ isPublished: !c.isPublished }),
                      });
                      await Promise.all([load(), refreshBootstrap()]);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
                  >
                    {c.isPublished ? 'Unpublish' : 'Publish'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'curriculum' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-xl font-extrabold">Modules &amp; Lessons Builder</h1>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="px-3.5 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              {ws.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-6">
              <form
                onSubmit={handleAddModule}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
              >
                <h2 className="text-sm font-bold">Add Module</h2>
                <input
                  type="text"
                  required
                  placeholder="Module Title"
                  value={newModTitle}
                  onChange={(e) => setNewModTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <input
                  type="text"
                  placeholder="Module Description"
                  value={newModDesc}
                  onChange={(e) => setNewModDesc(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Module</span>
                </button>
              </form>

              <form
                onSubmit={handleAddLesson}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
              >
                <h2 className="text-sm font-bold">Upload / Add Lesson &amp; PDF Notes</h2>
                <select
                  value={newLesson.moduleId}
                  onChange={(e) => setNewLesson({ ...newLesson, moduleId: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="">Select Module</option>
                  {ws.modules
                    .filter((m) => m.courseId === selectedCourseId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                </select>
                <input
                  type="text"
                  required
                  placeholder="Lesson Title"
                  value={newLesson.title}
                  onChange={(e) => setNewLesson({ ...newLesson, title: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <textarea
                  rows={2}
                  placeholder="Lesson Description"
                  value={newLesson.description}
                  onChange={(e) => setNewLesson({ ...newLesson, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <input
                  type="url"
                  placeholder="Video URL (MP4 optional)"
                  value={newLesson.videoUrl}
                  onChange={(e) => setNewLesson({ ...newLesson, videoUrl: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="PDF Filename (e.g. Guide.pdf)"
                    value={newLesson.pdfTitle}
                    onChange={(e) => setNewLesson({ ...newLesson, pdfTitle: e.target.value })}
                    className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder="Minutes"
                    value={newLesson.durationMinutes}
                    onChange={(e) => setNewLesson({ ...newLesson, durationMinutes: Number(e.target.value) })}
                    className="px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Practical Exercise Prompt"
                  value={newLesson.practicalExercise}
                  onChange={(e) => setNewLesson({ ...newLesson, practicalExercise: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <button
                  type="submit"
                  className="w-full py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
                >
                  Save Lesson
                </button>
              </form>
            </div>

            <div className="lg:col-span-7 space-y-4">
              {ws.modules
                .filter((m) => m.courseId === selectedCourseId)
                .map((m) => (
                  <div
                    key={m.id}
                    className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold">{m.title}</h3>
                      <button
                        type="button"
                        onClick={async () => {
                          await apiFetch(`/api/modules/${m.id}`, { method: 'DELETE' });
                          load();
                        }}
                        className="text-rose-600 p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {ws.lessons
                        .filter((l) => l.moduleId === m.id)
                        .map((l) => (
                          <div
                            key={l.id}
                            className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 flex items-center justify-between text-xs"
                          >
                            <div>
                              <div className="font-semibold">{l.title}</div>
                              <div className="text-slate-500">
                                {l.durationMinutes} min · PDF: {l.pdfTitle}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={async () => {
                                await apiFetch(`/api/lessons/${l.id}`, { method: 'DELETE' });
                                load();
                              }}
                              className="text-rose-600 hover:underline cursor-pointer"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch('/api/assignments', { method: 'POST', body: JSON.stringify(newAsg) });
                setNewAsg({ ...newAsg, title: '', instructions: '' });
                load();
              }}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
            >
              <h2 className="text-base font-bold">Create Assignment</h2>
              <select
                value={newAsg.courseId}
                onChange={(e) => setNewAsg({ ...newAsg, courseId: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                {ws.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Assignment Title"
                value={newAsg.title}
                onChange={(e) => setNewAsg({ ...newAsg, title: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <textarea
                rows={3}
                required
                placeholder="Instructions & Deliverables"
                value={newAsg.instructions}
                onChange={(e) => setNewAsg({ ...newAsg, instructions: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <button
                type="submit"
                className="w-full py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
              >
                Publish Assignment
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-base font-bold">Student Submissions ({ws.submissions.length})</h2>
            {ws.submissions.map((sub) => (
              <div
                key={sub.id}
                className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">
                    {studentMap.get(sub.studentId)?.fullName || 'Student'} · {courseMap.get(sub.courseId)?.title}
                  </span>
                  <StatusIndicator status={sub.status} />
                </div>
                <p className="text-slate-600 dark:text-slate-300">{sub.submissionText}</p>
                {sub.projectUrl && (
                  <div className="font-mono text-[#EA580C] dark:text-orange-400">{sub.projectUrl}</div>
                )}
                <div className="pt-2 flex items-center justify-between">
                  <span className="font-mono">
                    {sub.status === 'GRADED' ? `Score: ${sub.score}/100` : 'Awaiting review'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setGradingSub(sub);
                      setGradeScore(sub.score || 85);
                      setGradeFeedback(sub.feedback || '');
                    }}
                    className="px-3 py-1.5 font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
                  >
                    Grade Submission
                  </button>
                </div>
              </div>
            ))}

            {gradingSub && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  await apiFetch(`/api/submissions/${gradingSub.id}/grade`, {
                    method: 'POST',
                    body: JSON.stringify({ score: gradeScore, feedback: gradeFeedback }),
                  });
                  setGradingSub(null);
                  load();
                }}
                className="p-5 rounded-2xl border border-[#FCD5BA] dark:border-orange-800 bg-white dark:bg-slate-900 space-y-3"
              >
                <div className="text-sm font-bold">Grade Submission</div>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={gradeScore}
                  onChange={(e) => setGradeScore(Number(e.target.value))}
                  className="w-32 px-3 py-2 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <textarea
                  rows={3}
                  placeholder="Constructive feedback for the student..."
                  value={gradeFeedback}
                  onChange={(e) => setGradeFeedback(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <div className="flex gap-2">
                  <button type="submit" className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg">
                    Save Grade
                  </button>
                  <button
                    type="button"
                    onClick={() => setGradingSub(null)}
                    className="px-4 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {activeTab === 'quizzes' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await apiFetch('/api/quizzes', {
                  method: 'POST',
                  body: JSON.stringify({
                    courseId: newQuiz.courseId,
                    title: newQuiz.title,
                    description: newQuiz.description,
                    passingScore: newQuiz.passingScore,
                    questions: [
                      {
                        prompt: newQuiz.prompt,
                        options: [newQuiz.opt0, newQuiz.opt1, newQuiz.opt2],
                        correctIndex: newQuiz.correctIndex,
                      },
                    ],
                  }),
                });
                setNewQuiz({ ...newQuiz, title: '', description: '', prompt: '', opt0: '', opt1: '', opt2: '' });
                load();
              }}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
            >
              <h2 className="text-base font-bold">Create Course Quiz</h2>
              <select
                value={newQuiz.courseId}
                onChange={(e) => setNewQuiz({ ...newQuiz, courseId: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                {ws.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                placeholder="Quiz Title"
                value={newQuiz.title}
                onChange={(e) => setNewQuiz({ ...newQuiz, title: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <input
                type="text"
                required
                placeholder="Question Prompt"
                value={newQuiz.prompt}
                onChange={(e) => setNewQuiz({ ...newQuiz, prompt: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <input
                type="text"
                required
                placeholder="Option A"
                value={newQuiz.opt0}
                onChange={(e) => setNewQuiz({ ...newQuiz, opt0: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <input
                type="text"
                required
                placeholder="Option B"
                value={newQuiz.opt1}
                onChange={(e) => setNewQuiz({ ...newQuiz, opt1: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <input
                type="text"
                required
                placeholder="Option C"
                value={newQuiz.opt2}
                onChange={(e) => setNewQuiz({ ...newQuiz, opt2: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <select
                value={newQuiz.correctIndex}
                onChange={(e) => setNewQuiz({ ...newQuiz, correctIndex: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value={0}>Correct Answer: Option A</option>
                <option value={1}>Correct Answer: Option B</option>
                <option value={2}>Correct Answer: Option C</option>
              </select>
              <button
                type="submit"
                className="w-full py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer"
              >
                Publish Quiz
              </button>
            </form>
          </div>
          <div className="lg:col-span-7 space-y-3">
            <h2 className="text-base font-bold">Active Quizzes ({ws.quizzes.length})</h2>
            {ws.quizzes.map((q) => (
              <div
                key={q.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs space-y-1"
              >
                <div className="font-bold text-sm">{q.title}</div>
                <div className="text-slate-500">
                  {courseMap.get(q.courseId)?.title} · {q.questions.length} Questions · Pass {q.passingScore}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <div className="space-y-4">
          <h1 className="text-xl font-extrabold">Enrolled Students &amp; Progress</h1>
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-500">
                <tr>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Course</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {ws.enrolments.map((e) => (
                  <tr key={e.id}>
                    <td className="py-3 px-4 font-medium">{studentMap.get(e.studentId)?.fullName || e.studentId}</td>
                    <td className="py-3 px-4">{courseMap.get(e.courseId)?.title}</td>
                    <td className="py-3 px-4 font-mono tabular-nums">{e.progressPercent}%</td>
                    <td className="py-3 px-4">
                      <StatusIndicator status={e.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <h1 className="text-xl font-extrabold">Course Analytics</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ws.courses.map((c) => {
              const enrs = ws.enrolments.filter((e) => e.courseId === c.id);
              const avg =
                enrs.length > 0
                  ? Math.round(enrs.reduce((sum, e) => sum + e.progressPercent, 0) / enrs.length)
                  : 0;
              return (
                <div
                  key={c.id}
                  className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
                >
                  <div className="font-bold text-sm">{c.title}</div>
                  <div className="flex justify-between text-xs text-slate-500 font-mono tabular-nums">
                    <span>Enrolments: {enrs.length}</span>
                    <span>Avg Progress: {avg}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="space-y-3">
          <h1 className="text-xl font-extrabold">Notifications</h1>
          {ws.notifications.length === 0 ? (
            <p className="text-sm text-slate-500">No new notifications.</p>
          ) : (
            ws.notifications.map((n) => (
              <div
                key={n.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              >
                <div className="font-bold text-sm">{n.title}</div>
                <p className="text-slate-600 dark:text-slate-300 mt-1">{n.message}</p>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="max-w-xl space-y-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setProfileError('');
              try {
                await apiFetch('/api/auth/profile', { method: 'PATCH', body: JSON.stringify(profileForm) });
                await Promise.all([refreshUser(), refreshBootstrap()]);
                setProfileForm((p) => ({ ...p, newPassword: '' }));
                setNotice(
                  profileForm.newPassword
                    ? 'Instructor profile & password updated securely.'
                    : 'Instructor profile updated.'
                );
              } catch (err: any) {
                setProfileError(err.message || 'Unable to update profile.');
              }
            }}
            className="p-6 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4"
          >
            <h1 className="text-xl font-extrabold">Instructor Profile &amp; Credentials</h1>
            {profileError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-xs text-rose-700 dark:text-rose-300">
                {profileError}
              </div>
            )}
            <input
              type="text"
              placeholder="Full Name"
              value={profileForm.fullName}
              onChange={(e) => setProfileForm({ ...profileForm, fullName: e.target.value })}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <input
              type="text"
              placeholder="Specialization Title"
              value={profileForm.title}
              onChange={(e) => setProfileForm({ ...profileForm, title: e.target.value })}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <textarea
              rows={3}
              placeholder="Biography"
              value={profileForm.bio}
              onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
            />
            <div>
              <label className="block text-xs font-medium mb-1">
                New Strong Password (optional — 8+ chars, upper/lower/number/symbol)
              </label>
              <PasswordInput
                minLength={8}
                placeholder="Leave blank to keep current password"
                value={profileForm.newPassword}
                onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer"
            >
              Save Profile
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
                Login and password reset verification codes are sent directly to{' '}
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
    </DashboardShell>
  );
}
