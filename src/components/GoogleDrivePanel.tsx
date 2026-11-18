import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Film,
  Folder,
  FolderSync,
  Link2,
  RefreshCw,
  Search,
  Share2,
  ShieldAlert,
  Sparkles,
  X,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import {
  buildDrivePreviewUrl,
  disconnectGoogleDrive,
  extractDriveFolderId,
  getDriveAccessToken,
  getDriveItemMetadata,
  getDriveUser,
  initDriveAuth,
  isVideoDriveItem,
  listDriveFolderContents,
  scanDriveFolderVideos,
  shareDriveFileWithEmail,
  signInWithGoogleDrive,
  subscribeDriveAuth,
  type DriveFileItem,
} from '../lib/googleDrive';
import type { Course, Enrolment, Lesson, User } from '../types';

export function GoogleSignInButton({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="gsi-material-button inline-flex items-center gap-3 px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-sm font-medium shadow-xs transition-colors cursor-pointer disabled:opacity-60"
    >
      <span className="w-5 h-5 shrink-0 block">
        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block' }}>
          <path
            fill="#EA4335"
            d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
          />
          <path
            fill="#FBBC05"
            d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
          />
          <path fill="none" d="M0 0h48v48H0z" />
        </svg>
      </span>
      <span className="whitespace-nowrap">{loading ? 'Connecting Google Drive...' : 'Sign in with Google'}</span>
    </button>
  );
}

interface PendingBulkShareItem {
  enrolmentId: string;
  studentName: string;
  studentEmail: string;
  courseId: string;
  courseTitle: string;
  folderId?: string;
  folderName?: string;
  lessonFileIds: string[];
  alreadyShared?: boolean;
}

export function GoogleDrivePanel({
  courses,
  lessons,
  enrolments,
  students,
  onUpdated,
}: {
  courses: Course[];
  lessons: Lesson[];
  enrolments: Enrolment[];
  students: User[];
  onUpdated: () => void;
}) {
  const [connectedEmail, setConnectedEmail] = useState<string | null>(() => getDriveUser()?.email || null);
  const [needsAuth, setNeedsAuth] = useState<boolean>(() => !getDriveAccessToken());
  const [authLoading, setAuthLoading] = useState(false);

  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; name: string }>>([
    { id: 'root', name: 'My Drive' },
  ]);
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<DriveFileItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const [folderUrlInput, setFolderUrlInput] = useState('');
  const [scanningFolder, setScanningFolder] = useState(false);

  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id || '');
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Preview & confirm modal for linking a folder + syncing its video lessons
  const [pendingFolderSync, setPendingFolderSync] = useState<{
    courseId: string;
    courseTitle: string;
    folderId: string;
    folderName: string;
    videos: DriveFileItem[];
    replacePlaceholders: boolean;
  } | null>(null);
  const [syncingBusy, setSyncingBusy] = useState(false);

  // Explicit confirmation modal state for Drive permission sharing (single or bulk)
  const [pendingShares, setPendingShares] = useState<PendingBulkShareItem[] | null>(null);
  const [sharingBusy, setSharingBusy] = useState(false);

  useEffect(() => {
    const unsubInit = initDriveAuth(
      (fbUser) => {
        setConnectedEmail(fbUser.email);
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(!getDriveAccessToken());
      }
    );
    const unsubState = subscribeDriveAuth(({ user, token }) => {
      setConnectedEmail(user?.email || null);
      setNeedsAuth(!token);
    });
    return () => {
      unsubInit();
      unsubState();
    };
  }, []);

  const currentFolder = breadcrumbs[breadcrumbs.length - 1];

  const loadFiles = async (folderId = currentFolder.id, search?: string) => {
    if (!getDriveAccessToken()) {
      setNeedsAuth(true);
      return;
    }
    setLoadingFiles(true);
    setErrorMsg('');
    try {
      const files = await listDriveFolderContents(folderId, search);
      setItems(files);
    } catch (err: any) {
      setErrorMsg(err.message);
      if (err.message.toLowerCase().includes('sign in')) {
        setNeedsAuth(true);
      }
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (!needsAuth && getDriveAccessToken()) {
      loadFiles(currentFolder.id);
    }
  }, [needsAuth, currentFolder.id]);

  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setErrorMsg('');
    try {
      const res = await signInWithGoogleDrive();
      setConnectedEmail(res.user.email);
      setNeedsAuth(false);
      setStatusMsg(`Connected Google Drive account (${res.user.email}).`);
      await loadFiles('root');
    } catch (err: any) {
      setErrorMsg(err.message || 'Google Sign-In failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const prepareFolderSync = async (folderId: string, folderName?: string) => {
    if (!selectedCourseId) {
      setErrorMsg('Please select a target Academy course on the right first.');
      return;
    }
    if (!getDriveAccessToken()) {
      setNeedsAuth(true);
      setErrorMsg('Please sign in with Google Drive first.');
      return;
    }
    setScanningFolder(true);
    setErrorMsg('');
    try {
      const meta = folderName ? { id: folderId, name: folderName } : await getDriveItemMetadata(folderId);
      const videos = await scanDriveFolderVideos(meta.id, meta.name);
      const courseTitle = courses.find((c) => c.id === selectedCourseId)?.title || 'Selected Course';
      setPendingFolderSync({
        courseId: selectedCourseId,
        courseTitle,
        folderId: meta.id,
        folderName: meta.name,
        videos,
        replacePlaceholders: true,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to scan Google Drive folder.');
    } finally {
      setScanningFolder(false);
    }
  };

  const handlePasteFolderLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const extracted = extractDriveFolderId(folderUrlInput);
    if (!extracted) {
      setErrorMsg('Please paste a valid Google Drive folder link (e.g. https://drive.google.com/drive/folders/...) or folder ID.');
      return;
    }
    await prepareFolderSync(extracted);
  };

  const executeConfirmedFolderSync = async () => {
    if (!pendingFolderSync) return;
    setSyncingBusy(true);
    setErrorMsg('');
    try {
      const res = await apiFetch<{ course: Course; createdCount: number; updatedCount: number }>(
        `/api/courses/${pendingFolderSync.courseId}/drive-sync`,
        {
          method: 'POST',
          body: JSON.stringify({
            folderId: pendingFolderSync.folderId,
            folderName: pendingFolderSync.folderName,
            replacePlaceholders: pendingFolderSync.replacePlaceholders,
            videos: pendingFolderSync.videos.map((v) => ({
              id: v.id,
              name: v.name,
              folderName: v.folderName,
            })),
          }),
        }
      );
      setStatusMsg(
        `Linked Drive folder "${pendingFolderSync.folderName}" to ${pendingFolderSync.courseTitle} (${res.createdCount} videos imported, ${res.updatedCount} updated).`
      );
      setPendingFolderSync(null);
      setFolderUrlInput('');
      onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to sync course Drive videos.');
    } finally {
      setSyncingBusy(false);
    }
  };

  const handleAttachVideoToLesson = async (file: DriveFileItem) => {
    if (!selectedLessonId) {
      setErrorMsg('Select a course lesson on the right before linking an individual Google Drive video file.');
      return;
    }
    setErrorMsg('');
    try {
      await apiFetch(`/api/lessons/${selectedLessonId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          driveFileId: file.id,
          videoUrl: buildDrivePreviewUrl(file.id),
        }),
      });
      const lessonTitle = lessons.find((l) => l.id === selectedLessonId)?.title;
      setStatusMsg(`Linked Google Drive video "${file.name}" to "${lessonTitle}".`);
      onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const executeConfirmedShares = async () => {
    if (!pendingShares || pendingShares.length === 0) return;
    setSharingBusy(true);
    setErrorMsg('');
    try {
      const succeeded: Array<{ enrolmentId: string; email: string }> = [];
      const failures: string[] = [];

      for (const item of pendingShares) {
        try {
          if (item.folderId) {
            await shareDriveFileWithEmail(item.folderId, item.studentEmail);
          } else {
            for (const fid of item.lessonFileIds) {
              await shareDriveFileWithEmail(fid, item.studentEmail);
            }
          }
          succeeded.push({ enrolmentId: item.enrolmentId, email: item.studentEmail });
        } catch (err: any) {
          failures.push(`${item.studentEmail}: ${err.message}`);
        }
      }

      if (succeeded.length > 0) {
        await apiFetch('/api/admin/enrolments/drive-access-bulk', {
          method: 'POST',
          body: JSON.stringify({ items: succeeded }),
        });
        setStatusMsg(
          `Granted Google Drive Reader access to ${succeeded.length} student(s): ${succeeded
            .map((s) => s.email)
            .join(', ')}.`
        );
      }
      if (failures.length > 0) {
        setErrorMsg(`Some shares failed: ${failures.join(' | ')}`);
      }
      setPendingShares(null);
      onUpdated();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSharingBusy(false);
    }
  };

  const courseLessons = lessons.filter((l) => l.courseId === selectedCourseId);
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const studentMap = new Map(students.map((s) => [s.id, s]));
  const courseMap = new Map(courses.map((c) => [c.id, c]));

  const activeEnrolments = enrolments.filter((e) => e.status !== 'REVOKED');
  const shareableItems: Array<PendingBulkShareItem & { alreadyShared: boolean }> = activeEnrolments
    .map((e): (PendingBulkShareItem & { alreadyShared: boolean }) | null => {
      const st = studentMap.get(e.studentId);
      const cr = courseMap.get(e.courseId);
      if (!st || !cr) return null;
      const lessonFileIds = lessons
        .filter((l) => l.courseId === cr.id && !l.isFreePreview && l.driveFileId)
        .map((l) => l.driveFileId!);
      if (!cr.driveFolderId && lessonFileIds.length === 0) return null;
      return {
        enrolmentId: e.id,
        studentName: st.fullName,
        studentEmail: st.email,
        courseId: cr.id,
        courseTitle: cr.title,
        folderId: cr.driveFolderId,
        folderName: cr.driveFolderName || cr.title,
        lessonFileIds,
        alreadyShared: Boolean(e.driveAccessEmail),
      };
    })
    .filter((x): x is PendingBulkShareItem & { alreadyShared: boolean } => x !== null);

  const awaitingDriveShare = shareableItems.filter((item) => !item.alreadyShared);

  return (
    <div className="space-y-6">
      {/* Header & Connection Status */}
      <div className="p-6 rounded-2xl bg-[#111827] text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-orange-300">
            Google Drive Course Video Library
          </div>
          <h1 className="text-xl font-extrabold">
            Connect emmanuelsansah020@gmail.com Google Drive
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            Link your Google Drive course folders to import all paid video lessons automatically, and grant Reader access
            to students&apos; sign-up emails immediately upon Mobile Money payment verification.
          </p>
        </div>

        <div className="shrink-0">
          {needsAuth ? (
            <GoogleSignInButton onClick={handleGoogleSignIn} loading={authLoading} />
          ) : (
            <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-700 px-4 py-2.5 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <div className="text-xs">
                <div className="font-semibold text-white">{connectedEmail || 'Google Drive Connected'}</div>
                <button
                  type="button"
                  onClick={async () => {
                    await disconnectGoogleDrive();
                    setConnectedEmail(null);
                    setNeedsAuth(true);
                    setItems([]);
                  }}
                  className="text-orange-300 hover:underline cursor-pointer"
                >
                  Disconnect Drive
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 flex justify-between gap-3">
          <span>{statusMsg}</span>
          <button type="button" onClick={() => setStatusMsg('')} className="underline cursor-pointer shrink-0">
            Dismiss
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* Pending Automatic Google Drive Share Banner */}
      {awaitingDriveShare.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5 text-xs">
            <div className="font-bold text-amber-900 dark:text-amber-200">
              {awaitingDriveShare.length} Paid Student(s) Awaiting Google Drive Folder Access
            </div>
            <div className="text-amber-800 dark:text-amber-300">
              These students have approved payments. Share the linked Google Drive folder with their sign-up emails now.
            </div>
          </div>
          <button
            type="button"
            disabled={needsAuth}
            onClick={() => setPendingShares(awaitingDriveShare)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] disabled:opacity-40 rounded-lg cursor-pointer shrink-0"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Drive Access ({awaitingDriveShare.length})</span>
          </button>
        </div>
      )}

      {/* Pre-Linked Course Google Drive Folders */}
      {courses.some((c) => Boolean(c.driveFolderId)) && (
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold">Linked Course Google Drive Tutorial Folders</h2>
              <p className="text-xs text-slate-500">
                Students automatically unlock access to the matching Google Drive folder after MTN MoMo payment approval.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {courses
              .filter((c) => Boolean(c.driveFolderId))
              .map((c) => {
                const syncedCount = lessons.filter((l) => l.courseId === c.id && Boolean(l.driveFileId)).length;
                return (
                  <div
                    key={c.id}
                    className="p-4 rounded-xl border border-[#EFE7DF] dark:border-slate-800 bg-[#FFFBF7] dark:bg-slate-950/60 flex flex-col justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="font-bold text-[#111827] dark:text-white line-clamp-1">{c.title}</div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {c.driveFolderName || c.driveFolderId}
                      </div>
                      <div className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                        GH₵ {c.priceGhs} · {syncedCount > 0 ? `${syncedCount} synced video lessons` : 'Folder linked (ready to sync videos)'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <a
                        href={`https://drive.google.com/drive/folders/${c.driveFolderId}?usp=drive_link`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-white dark:hover:bg-slate-800"
                      >
                        <span>Open Folder</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      {!needsAuth && (
                        <button
                          type="button"
                          disabled={scanningFolder}
                          onClick={() => {
                            setSelectedCourseId(c.id);
                            prepareFolderSync(c.driveFolderId!, c.driveFolderName);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] disabled:opacity-50 rounded-lg cursor-pointer"
                        >
                          <FolderSync className="w-3 h-3" />
                          <span>Sync Videos</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Course / Lesson Target Mapping + Drive Browser */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-4">
          {/* Quick Paste Drive Folder URL Bar */}
          {!needsAuth && (
            <form
              onSubmit={handlePasteFolderLink}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row gap-2 items-stretch sm:items-center"
            >
              <input
                type="text"
                placeholder="Paste Google Drive folder link (https://drive.google.com/drive/folders/...)"
                value={folderUrlInput}
                onChange={(e) => setFolderUrlInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <button
                type="submit"
                disabled={scanningFolder || !folderUrlInput.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] disabled:opacity-50 rounded-lg cursor-pointer shrink-0"
              >
                <FolderSync className={`w-3.5 h-3.5 ${scanningFolder ? 'animate-spin' : ''}`} />
                <span>{scanningFolder ? 'Scanning Videos...' : 'Link & Sync Folder URL'}</span>
              </button>
            </form>
          )}

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium">
                {breadcrumbs.map((b, idx) => (
                  <React.Fragment key={b.id}>
                    {idx > 0 && <span className="text-slate-400">/</span>}
                    <button
                      type="button"
                      onClick={() => setBreadcrumbs((prev) => prev.slice(0, idx + 1))}
                      className="hover:underline text-[#EA580C] dark:text-orange-400 cursor-pointer"
                    >
                      {b.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search Drive..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') loadFiles(currentFolder.id, searchTerm);
                    }}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => loadFiles(currentFolder.id, searchTerm || undefined)}
                  disabled={needsAuth || loadingFiles}
                  className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-40"
                  aria-label="Refresh Drive files"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFiles ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {needsAuth ? (
              <div className="p-10 text-center space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Sign in with <strong>emmanuelsansah020@gmail.com</strong> using the button below to browse your{' '}
                  <strong>AI WEB DESIGN COURSE</strong> and Video Creation folders.
                </p>
                <div className="flex justify-center">
                  <GoogleSignInButton onClick={handleGoogleSignIn} loading={authLoading} />
                </div>
              </div>
            ) : loadingFiles ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading Google Drive files...</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">No files or folders found in this directory.</div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[460px] overflow-y-auto">
                {items.map((item) => {
                  const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
                  const isVideo = isVideoDriveItem(item);
                  return (
                    <div
                      key={item.id}
                      className="px-4 py-3 flex items-center justify-between gap-3 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (isFolder) {
                            setSearchTerm('');
                            setBreadcrumbs((prev) => [...prev, { id: item.id, name: item.name }]);
                          }
                        }}
                        className={`flex items-center gap-2.5 text-left min-w-0 flex-1 ${
                          isFolder ? 'cursor-pointer font-semibold text-[#111827] dark:text-white' : 'cursor-default'
                        }`}
                      >
                        {isFolder ? (
                          <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                        ) : (
                          <Film className="w-4 h-4 text-[#EA580C] dark:text-orange-400 shrink-0" />
                        )}
                        <span className="truncate">{item.name}</span>
                      </button>

                      <div className="flex items-center gap-2 shrink-0">
                        {isFolder && (
                          <button
                            type="button"
                            disabled={scanningFolder}
                            onClick={() => prepareFolderSync(item.id, item.name)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-[#EA580C] hover:bg-[#D44E07] disabled:opacity-50 text-white rounded-lg cursor-pointer"
                          >
                            <FolderSync className="w-3 h-3" />
                            <span>Link &amp; Import Videos</span>
                          </button>
                        )}
                        {isVideo && (
                          <button
                            type="button"
                            onClick={() => handleAttachVideoToLesson(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer"
                          >
                            <Link2 className="w-3 h-3" />
                            <span>Attach to Lesson</span>
                          </button>
                        )}
                        {item.webViewLink && (
                          <a
                            href={item.webViewLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                            title="Open in Google Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Course & Lesson Link Target */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
            <h2 className="text-sm font-bold">1. Link Google Drive Folder to Course</h2>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Select Academy Course</label>
              <select
                value={selectedCourseId}
                onChange={(e) => {
                  setSelectedCourseId(e.target.value);
                  setSelectedLessonId('');
                }}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} (GH₵ {c.priceGhs})
                  </option>
                ))}
              </select>
              {selectedCourse?.driveFolderId ? (
                <div className="mt-2 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
                  <span>
                    Linked Folder: <strong>{selectedCourse.driveFolderName || selectedCourse.driveFolderId}</strong>
                  </span>
                  {!needsAuth && (
                    <button
                      type="button"
                      disabled={scanningFolder}
                      onClick={() =>
                        prepareFolderSync(selectedCourse.driveFolderId!, selectedCourse.driveFolderName)
                      }
                      className="text-emerald-700 dark:text-emerald-200 font-semibold underline cursor-pointer shrink-0"
                    >
                      Re-Sync Videos
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-500">
                  No Google Drive folder linked yet. Click &ldquo;Link &amp; Import Videos&rdquo; next to any folder on
                  the left or paste a folder URL.
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Optional: Attach Single Video to Specific Lesson
              </label>
              <select
                value={selectedLessonId}
                onChange={(e) => setSelectedLessonId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
              >
                <option value="">Choose a lesson...</option>
                {courseLessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.isFreePreview ? '[FREE] ' : '[PAID] '}
                    {l.title} {l.driveFileId ? '✓ Drive Linked' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Paid Student Google Drive Access */}
          <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold">2. Paid Student Google Drive Access</h2>
              {awaitingDriveShare.length > 0 && !needsAuth && (
                <button
                  type="button"
                  onClick={() => setPendingShares(awaitingDriveShare)}
                  className="text-[11px] font-semibold text-[#EA580C] dark:text-orange-400 hover:underline cursor-pointer"
                >
                  Share All ({awaitingDriveShare.length})
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Approved payments automatically share the linked course Drive folder to the student&apos;s sign-up email.
              Use this panel to share or re-send access for existing paid students.
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activeEnrolments.length === 0 ? (
                <div className="text-xs text-slate-400 py-3">No active paid enrolments yet.</div>
              ) : (
                activeEnrolments.map((e) => {
                  const st = studentMap.get(e.studentId);
                  const cr = courseMap.get(e.courseId);
                  if (!st || !cr) return null;
                  const lessonFileIds = lessons
                    .filter((l) => l.courseId === cr.id && !l.isFreePreview && l.driveFileId)
                    .map((l) => l.driveFileId!);
                  const hasShareTarget = Boolean(cr.driveFolderId || lessonFileIds.length > 0);
                  return (
                    <div
                      key={e.id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{st.fullName}</div>
                        <div className="text-slate-500 font-mono truncate">{st.email}</div>
                        <div className="text-[11px] text-[#EA580C] dark:text-orange-400 truncate">{cr.title}</div>
                      </div>
                      {e.driveAccessEmail ? (
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            Shared ✓
                          </span>
                          {hasShareTarget && !needsAuth && (
                            <button
                              type="button"
                              onClick={() =>
                                setPendingShares([
                                  {
                                    enrolmentId: e.id,
                                    studentName: st.fullName,
                                    studentEmail: st.email,
                                    courseId: cr.id,
                                    courseTitle: cr.title,
                                    folderId: cr.driveFolderId,
                                    folderName: cr.driveFolderName || cr.title,
                                    lessonFileIds,
                                  },
                                ])
                              }
                              className="text-[10px] text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline cursor-pointer"
                            >
                              Re-share
                            </button>
                          )}
                        </div>
                      ) : hasShareTarget ? (
                        <button
                          type="button"
                          disabled={needsAuth}
                          onClick={() =>
                            setPendingShares([
                              {
                                enrolmentId: e.id,
                                studentName: st.fullName,
                                studentEmail: st.email,
                                courseId: cr.id,
                                courseTitle: cr.title,
                                folderId: cr.driveFolderId,
                                folderName: cr.driveFolderName || cr.title,
                                lessonFileIds,
                              },
                            ])
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer disabled:opacity-40 shrink-0"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>Grant Drive</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-400 shrink-0">Link Folder First</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Folder Link & Video Import Preview Modal */}
      {pendingFolderSync && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Course Google Drive Video Sync"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-[#EA580C] dark:text-orange-400" />
                <span>Link Folder &amp; Import Videos to Course</span>
              </div>
              <button
                type="button"
                onClick={() => setPendingFolderSync(null)}
                className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-1">
                <div>
                  <span className="text-slate-500">Google Drive Folder:</span>{' '}
                  <strong className="text-slate-900 dark:text-white">{pendingFolderSync.folderName}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Target Course:</span>{' '}
                  <strong className="text-[#EA580C] dark:text-orange-400">{pendingFolderSync.courseTitle}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Videos Found (incl. subfolders):</span>{' '}
                  <strong>{pendingFolderSync.videos.length} video(s)</strong>
                </div>
              </div>

              {pendingFolderSync.videos.length > 0 ? (
                <div className="space-y-2">
                  <div className="font-semibold text-slate-700 dark:text-slate-200">
                    Imported as Paid Lessons (Locked Until MoMo Verification):
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg">
                    {pendingFolderSync.videos.map((v, idx) => (
                      <div key={v.id} className="px-3 py-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {idx + 1}. {v.name}
                          </div>
                          {v.folderName && <div className="text-[10px] text-slate-400 truncate">{v.folderName}</div>}
                        </div>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 shrink-0">
                          PAID
                        </span>
                      </div>
                    ))}
                  </div>
                  <label className="flex items-center gap-2 pt-1 cursor-pointer text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={pendingFolderSync.replacePlaceholders}
                      onChange={(e) =>
                        setPendingFolderSync({ ...pendingFolderSync, replacePlaceholders: e.target.checked })
                      }
                    />
                    <span>Replace unlinked placeholder paid lessons (keeps Free Lesson 1 intact)</span>
                  </label>
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300">
                  No direct video files were detected inside this folder or its immediate subfolders, but linking the
                  folder will still automatically grant paid students access to open this Google Drive folder after
                  payment!
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingFolderSync(null)}
                className="px-4 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={syncingBusy}
                onClick={executeConfirmedFolderSync}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-lg cursor-pointer disabled:opacity-50"
              >
                {syncingBusy
                  ? 'Linking & Importing...'
                  : pendingFolderSync.videos.length > 0
                  ? `Link Folder & Import ${pendingFolderSync.videos.length} Video(s)`
                  : 'Link Drive Folder to Course'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Confirmation Dialog Before Mutating Google Drive Permissions */}
      {pendingShares && pendingShares.length > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Google Drive Permission Sharing"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <ShieldAlert className="w-4 h-4 text-[#EA580C] dark:text-orange-400" />
                <span>Confirm Google Drive Access Share</span>
              </div>
              <button
                type="button"
                onClick={() => setPendingShares(null)}
                className="p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <p>
                You are about to add <strong>Reader</strong> permissions in your Google Drive account (
                <span className="font-mono">{connectedEmail || 'emmanuelsansah020@gmail.com'}</span>) for{' '}
                <strong>{pendingShares.length} paid student(s)</strong> so they can access their course videos:
              </p>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800 space-y-2 max-h-52 overflow-y-auto">
                {pendingShares.map((item) => (
                  <div key={item.enrolmentId} className="pb-2 last:pb-0 border-b last:border-b-0 border-slate-200 dark:border-slate-700">
                    <div className="font-semibold text-slate-900 dark:text-white">{item.studentName}</div>
                    <div className="font-mono text-[#EA580C] dark:text-orange-400">{item.studentEmail}</div>
                    <div className="text-[11px] text-slate-500">
                      Item: {item.folderName} ({item.courseTitle})
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingShares(null)}
                className="px-4 py-2 text-xs font-medium border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={sharingBusy}
                onClick={executeConfirmedShares}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer disabled:opacity-50"
              >
                {sharingBusy ? 'Sharing Access...' : `Confirm & Share (${pendingShares.length}) on Google Drive`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
