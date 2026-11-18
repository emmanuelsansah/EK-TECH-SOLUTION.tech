import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Lock,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { apiFetch, downloadPdfWithAuth } from '../lib/api';
import { buildDrivePreviewUrl, buildDriveViewUrl, extractDriveFileId } from '../lib/googleDrive';
import { useApp } from '../context/AppContext';
import { CertificateModal, MoMoPaymentModal } from '../components/UiPrimitives';
import type {
  Assignment,
  AssignmentSubmission,
  Certificate,
  Course,
  Enrolment,
  Lesson,
  Module,
  Payment,
  Quiz,
  QuizAttempt,
  User,
} from '../types';

interface LearningRoomPayload {
  course: Course;
  instructor: User | null;
  modules: Module[];
  lessons: Lesson[];
  enrolment: Enrolment | null;
  hasFullAccess: boolean;
  pendingPayment: Payment | null;
  assignments: Assignment[];
  submissions: AssignmentSubmission[];
  quizzes: Quiz[];
  quizAttempts: QuizAttempt[];
  certificate: Certificate | null;
}

export function LearningRoom({
  courseId,
  onBack,
  onProgressUpdated,
}: {
  courseId: string;
  onBack: () => void;
  onProgressUpdated: () => void;
}) {
  const { user, bootstrap } = useApp();
  const [data, setData] = useState<LearningRoomPayload | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingProgress, setSavingProgress] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [certModal, setCertModal] = useState<Certificate | null>(null);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showFolderPreview, setShowFolderPreview] = useState(false);

  // Interactive fallback tutorial state (only if lesson has no videoUrl yet)
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSec, setPlaybackSec] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.25 | 1.5>(1);

  const loadRoom = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<LearningRoomPayload>(`/api/learning/${courseId}`);
      setData(res);
      const preferred =
        res.enrolment?.lastLessonId && res.lessons.some((l) => l.id === res.enrolment?.lastLessonId)
          ? res.enrolment.lastLessonId
          : res.lessons[0]?.id || '';
      setActiveLessonId(preferred);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Unable to load learning room');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoom();
  }, [courseId]);

  useEffect(() => {
    setIsPlaying(false);
    setPlaybackSec(0);
  }, [activeLessonId]);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setPlaybackSec((s) => s + 1);
    }, Math.round(1000 / playbackSpeed));
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed]);

  if (loading) {
    return (
      <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse space-y-4">
        <div className="h-8 w-1/3 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 rounded-xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 space-y-4">
        <p className="text-sm text-rose-700 dark:text-rose-300">{error}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer"
        >
          Back to Courses
        </button>
      </div>
    );
  }

  const { course, instructor, modules, lessons, enrolment, hasFullAccess, pendingPayment, certificate } = data;
  const activeIdx = Math.max(
    0,
    lessons.findIndex((l) => l.id === activeLessonId)
  );
  const currentLesson = lessons[activeIdx];
  const completedSet = new Set(enrolment?.completedLessonIds || []);
  const totalSec = (currentLesson?.durationMinutes || 15) * 60;
  const currentSec = Math.min(playbackSec, totalSec);
  const momoNumber = bootstrap?.settings.momoNumber || '0257460536';

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleToggleComplete = async (lessonId: string, markDone: boolean) => {
    setSavingProgress(true);
    try {
      const res = await apiFetch<{ enrolment: Enrolment; newlyIssuedCertificate: Certificate | null }>(
        `/api/learning/${course.id}/progress`,
        {
          method: 'POST',
          body: JSON.stringify({ lessonId, completed: markDone }),
        }
      );
      setData((prev) =>
        prev
          ? {
              ...prev,
              enrolment: res.enrolment,
              certificate: res.newlyIssuedCertificate || prev.certificate,
            }
          : prev
      );
      if (res.newlyIssuedCertificate) {
        setCertModal(res.newlyIssuedCertificate);
      }
      onProgressUpdated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingProgress(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!currentLesson || currentLesson.locked) return;
    setDownloadingPdf(true);
    try {
      await downloadPdfWithAuth(
        `/api/materials/${currentLesson.id}/download`,
        currentLesson.pdfTitle || 'EK_Tech_Study_Notes.pdf'
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDownloadingPdf(false);
    }
  };

  const resolvedDriveFileId =
    currentLesson?.driveFileId || extractDriveFileId(currentLesson?.videoUrl) || null;
  const isDrivePreviewUrl = Boolean(
    resolvedDriveFileId || (currentLesson?.videoUrl && currentLesson.videoUrl.includes('drive.google.com'))
  );
  const effectiveVideoUrl = resolvedDriveFileId
    ? buildDrivePreviewUrl(resolvedDriveFileId)
    : currentLesson?.videoUrl;
  const directDriveViewUrl = resolvedDriveFileId ? buildDriveViewUrl(resolvedDriveFileId) : null;

  return (
    <div className="space-y-6">
      {/* Top Room Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#EA580C] dark:text-orange-400 hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Courses</span>
          </button>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#111827] dark:text-white">
            {course.title}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Instructor: {instructor?.fullName || 'Emmanuel Sansah'} ·{' '}
            {hasFullAccess
              ? 'Full Course Unlocked'
              : `Free Preview Mode (Lesson 1 Open · GH₵ ${course.priceGhs} to Unlock All Videos)`}
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          {hasFullAccess ? (
            <div className="text-right">
              <div className="text-xs text-slate-500 dark:text-slate-400">Course Progress</div>
              <div className="text-lg font-bold font-mono tabular-nums text-[#EA580C] dark:text-orange-400">
                {enrolment?.progressPercent ?? 0}%
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowPayModal(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl whitespace-nowrap cursor-pointer transition-colors"
            >
              Unlock Full Course · GH₵ {course.priceGhs}
            </button>
          )}
          {certificate && (
            <button
              type="button"
              onClick={() => setCertModal(certificate)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl cursor-pointer"
            >
              <Award className="w-4 h-4" />
              <span>View Certificate</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {hasFullAccess && (
        <div className="w-full h-2 rounded-full bg-[#EFE7DF] dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-[#EA580C] dark:bg-orange-400 transition-all duration-300"
            style={{ width: `${enrolment?.progressPercent ?? 0}%` }}
          />
        </div>
      )}

      {/* Unlocked Google Drive Course Library Banner for Paid Students */}
      {hasFullAccess && course.driveFolderId && (
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="font-bold text-emerald-900 dark:text-emerald-200">
              Full Google Drive Video Folder Unlocked
              {course.driveFolderName ? ` — ${course.driveFolderName}` : ''}
            </div>
            <div className="text-emerald-800 dark:text-emerald-300">
              {enrolment?.driveAccessEmail ? (
                <>
                  Google Drive Reader access shared with{' '}
                  <span className="font-mono font-semibold">{enrolment.driveAccessEmail}</span>
                </>
              ) : (
                <>
                  Course unlocked for{' '}
                  <span className="font-mono font-semibold">{user?.email}</span> — click the button to open your
                  Google Drive tutorials folder.
                </>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFolderPreview((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-2 font-semibold border border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 bg-white dark:bg-slate-900 hover:bg-emerald-100/60 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <span>{showFolderPreview ? 'Hide Drive Folder List' : 'Browse Folder Here'}</span>
            </button>
            <a
              href={`https://drive.google.com/drive/folders/${course.driveFolderId}?usp=drive_link`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
            >
              <span>Open Course Folder in Drive</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}

      {hasFullAccess && course.driveFolderId && showFolderPreview && (
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900 flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-900 dark:text-emerald-200">
              Course Google Drive Files ({course.driveFolderName || 'Tutorials'})
            </span>
            <a
              href={`https://drive.google.com/drive/folders/${course.driveFolderId}?usp=drive_link`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-emerald-700 dark:text-emerald-300 hover:underline inline-flex items-center gap-1"
            >
              <span>Open in Google Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <iframe
            src={`https://drive.google.com/embeddedfolderview?id=${course.driveFolderId}#grid`}
            title={`${course.title} Google Drive Tutorials`}
            className="w-full h-80 border-0 bg-white"
          />
        </div>
      )}

      {/* Two-Zone Learning Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Video Player / Payment Gate + Lesson Notes */}
        <div className="lg:col-span-8 space-y-6">
          {currentLesson ? (
            <>
              <div className="rounded-2xl overflow-hidden border border-[#EFE7DF] dark:border-slate-800 bg-[#111827] text-white">
                {currentLesson.locked ? (
                  <div className="aspect-video flex flex-col items-center justify-center p-6 sm:p-10 text-center bg-gradient-to-br from-[#111827] via-[#1F2937] to-[#7C2D12] space-y-4">
                    <div className="w-12 h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                      <Lock className="w-6 h-6 text-orange-300" />
                    </div>
                    <div className="space-y-2 max-w-lg">
                      <div className="text-xs font-semibold uppercase tracking-wider text-orange-300">
                        Paid Course Content Locked
                      </div>
                      <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                        {currentLesson.title}
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                        Freshly logged-in accounts have free access to Lesson 1 only. To continue watching the rest of
                        the videos in this course and receive Google Drive access on your sign-up email (
                        <span className="font-mono text-orange-300">{user?.email}</span>), complete your{' '}
                        <strong className="text-white">GH₵ {course.priceGhs}</strong> MTN Mobile Money payment to{' '}
                        <span className="font-mono text-orange-300">{momoNumber}</span>.
                      </p>
                    </div>

                    {pendingPayment ? (
                      <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs font-semibold">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>
                          Payment Pending Verification (TxID: {pendingPayment.transactionId}) — Access will unlock on{' '}
                          {pendingPayment.email}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowPayModal(true)}
                        className="px-6 py-3 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl transition-colors cursor-pointer"
                      >
                        Pay GH₵ {course.priceGhs} via MTN MoMo to Unlock All Videos
                      </button>
                    )}
                  </div>
                ) : effectiveVideoUrl ? (
                  isDrivePreviewUrl ? (
                    <div>
                      <iframe
                        key={currentLesson.id}
                        src={effectiveVideoUrl}
                        title={currentLesson.title}
                        allow="autoplay; fullscreen"
                        className="w-full aspect-video border-0 bg-black"
                      />
                      {directDriveViewUrl && (
                        <div className="px-4 py-2.5 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
                          <span>Streaming from Academy Google Drive ({user?.email})</span>
                          <a
                            href={directDriveViewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-orange-300 hover:underline"
                          >
                            <span>Open Video Directly in Google Drive</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <video
                      key={currentLesson.id}
                      controls
                      playsInline
                      preload="metadata"
                      src={effectiveVideoUrl}
                      className="w-full aspect-video bg-black"
                    />
                  )
                ) : (
                  <div className="aspect-video flex flex-col justify-between p-6 sm:p-8 bg-gradient-to-br from-[#111827] via-[#1F2937] to-[#7C2D12]">
                    <div className="flex items-center justify-between text-xs text-orange-300">
                      <span className="font-mono">
                        Lesson {activeIdx + 1} of {lessons.length}
                      </span>
                      <span className="font-mono tabular-nums">
                        {currentLesson.durationMinutes} min tutorial
                      </span>
                    </div>

                    <div className="space-y-3 max-w-2xl">
                      <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug">
                        {currentLesson.title}
                      </h2>
                      <p className="text-sm text-slate-200 leading-relaxed">{currentLesson.description}</p>
                      {course.driveFolderId && (
                        <div className="pt-2 flex flex-wrap items-center gap-3">
                          <a
                            href={`https://drive.google.com/drive/folders/${course.driveFolderId}?usp=drive_link`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl"
                          >
                            <span>Watch Tutorials in Google Drive Folder</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => setShowFolderPreview(true)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-orange-200 border border-orange-400/40 hover:bg-white/10 rounded-xl cursor-pointer"
                          >
                            <span>View Folder Files Above</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="space-y-3 pt-4 border-t border-white/10">
                      <div className="w-full h-1.5 bg-white/15 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-orange-400 transition-all"
                          style={{ width: `${Math.min(100, (currentSec / totalSec) * 100)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => setIsPlaying((p) => !p)}
                            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-[#EA580C] hover:bg-[#D44E07] text-white rounded-xl cursor-pointer"
                          >
                            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            <span>{isPlaying ? 'Pause Tutorial' : 'Play Tutorial'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsPlaying(false);
                              setPlaybackSec(0);
                            }}
                            aria-label="Restart lesson"
                            className="p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                          <span className="text-xs font-mono tabular-nums text-slate-300">
                            {formatTimer(currentSec)} / {formatTimer(totalSec)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          {([1, 1.25, 1.5] as const).map((spd) => (
                            <button
                              key={spd}
                              type="button"
                              onClick={() => setPlaybackSpeed(spd)}
                              className={`px-2 py-1 text-xs font-mono rounded cursor-pointer ${
                                playbackSpeed === spd
                                  ? 'bg-orange-400 text-slate-950 font-bold'
                                  : 'text-slate-300 hover:bg-white/10'
                              }`}
                            >
                              {spd}x
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Lesson Action Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={activeIdx <= 0}
                    onClick={() => setActiveLessonId(lessons[activeIdx - 1].id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg disabled:opacity-40 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Previous Lesson</span>
                  </button>
                  <button
                    type="button"
                    disabled={activeIdx >= lessons.length - 1}
                    onClick={() => setActiveLessonId(lessons[activeIdx + 1].id)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-300 dark:border-slate-700 rounded-lg disabled:opacity-40 cursor-pointer"
                  >
                    <span>Next Lesson</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {hasFullAccess && enrolment ? (
                  <button
                    type="button"
                    disabled={savingProgress}
                    onClick={() =>
                      handleToggleComplete(currentLesson.id, !completedSet.has(currentLesson.id))
                    }
                    className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl transition-colors cursor-pointer ${
                      completedSet.has(currentLesson.id)
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                        : 'bg-[#EA580C] text-white hover:bg-[#D44E07]'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {completedSet.has(currentLesson.id) ? 'Completed' : 'Mark as Complete'}
                    </span>
                  </button>
                ) : (
                  !pendingPayment && (
                    <button
                      type="button"
                      onClick={() => setShowPayModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer transition-colors"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Unlock Remaining Videos (GH₵ {course.priceGhs})</span>
                    </button>
                  )
                )}
              </div>

              {/* PDF Study Notes & Practical Exercise */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-[#111827] dark:text-white">
                    <FileText className="w-4 h-4 text-[#EA580C] dark:text-orange-400" />
                    <span>Downloadable Study Notes</span>
                  </div>
                  <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">
                    {currentLesson.pdfSummary || currentLesson.description}
                  </p>
                  {!currentLesson.locked ? (
                    <button
                      type="button"
                      disabled={downloadingPdf}
                      onClick={handleDownloadPdf}
                      className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[#EA580C] dark:text-orange-400 border border-[#FCD5BA] dark:border-slate-700 hover:bg-[#FFF7F0] dark:hover:bg-slate-800 rounded-xl cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{downloadingPdf ? 'Preparing PDF...' : `Download ${currentLesson.pdfTitle}`}</span>
                    </button>
                  ) : (
                    <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                      Locked until GH₵ {course.priceGhs} payment verification.
                    </div>
                  )}
                </div>

                <div className="p-5 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                  <div className="text-sm font-bold text-[#111827] dark:text-white">Practical Exercise</div>
                  <p className="text-xs text-[#4B5563] dark:text-slate-300 leading-relaxed">
                    {currentLesson.practicalExercise || 'Apply the concepts from this lesson in a small practice build.'}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 text-sm text-slate-500">
              No lessons have been added to this course yet.
            </div>
          )}
        </div>

        {/* Right: Course Modules & Lesson List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="px-4 py-3 border-b border-[#EFE7DF] dark:border-slate-800 bg-[#FFF7F0] dark:bg-slate-900/70">
              <h3 className="text-sm font-bold text-[#111827] dark:text-white">Course Modules</h3>
            </div>
            <div className="divide-y divide-[#EFE7DF] dark:divide-slate-800 max-h-[600px] overflow-y-auto">
              {modules.map((mod) => {
                const modLessons = lessons.filter((l) => l.moduleId === mod.id);
                return (
                  <div key={mod.id} className="p-4 space-y-2">
                    <div className="text-xs font-bold text-[#111827] dark:text-slate-200">{mod.title}</div>
                    <div className="space-y-1">
                      {modLessons.map((les) => {
                        const isCurrent = les.id === currentLesson?.id;
                        const isDone = completedSet.has(les.id);
                        return (
                          <button
                            key={les.id}
                            type="button"
                            onClick={() => setActiveLessonId(les.id)}
                            className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-xs rounded-xl transition-colors cursor-pointer ${
                              isCurrent
                                ? 'bg-[#EA580C] text-white font-semibold'
                                : 'text-[#4B5563] dark:text-slate-300 hover:bg-[#FFF7F0] dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              {les.locked ? (
                                <Lock
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isCurrent ? 'text-orange-200' : 'text-amber-500'
                                  }`}
                                />
                              ) : (
                                <CheckCircle2
                                  className={`w-3.5 h-3.5 shrink-0 ${
                                    isCurrent
                                      ? 'text-orange-200'
                                      : isDone
                                      ? 'text-emerald-500'
                                      : 'text-slate-400'
                                  }`}
                                />
                              )}
                              <span className="truncate">{les.title}</span>
                            </span>
                            <span className="font-mono tabular-nums opacity-75 shrink-0">
                              {les.isFreePreview && !hasFullAccess ? 'FREE' : `${les.durationMinutes}m`}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showPayModal && (
        <MoMoPaymentModal
          course={course}
          onClose={() => setShowPayModal(false)}
          onSuccess={() => {
            loadRoom();
            onProgressUpdated();
          }}
        />
      )}

      {certModal && <CertificateModal certificate={certModal} onClose={() => setCertModal(null)} />}
    </div>
  );
}
