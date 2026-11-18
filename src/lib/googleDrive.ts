import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/drive'];

const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));
provider.setCustomParameters({ prompt: 'select_account' });

let isSigningIn = false;
// Access token is kept strictly in memory (never localStorage or sessionStorage)
let cachedAccessToken: string | null = null;
let cachedFirebaseUser: FirebaseUser | null = null;

type DriveAuthListener = (state: { user: FirebaseUser | null; token: string | null }) => void;
const listeners = new Set<DriveAuthListener>();

function notifyDriveAuthListeners() {
  const snapshot = { user: cachedFirebaseUser, token: cachedAccessToken };
  listeners.forEach((fn) => fn(snapshot));
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  size?: string;
  parents?: string[];
  folderName?: string;
}

export function isVideoDriveItem(item: Pick<DriveFileItem, 'mimeType' | 'name'>): boolean {
  if (item.mimeType?.startsWith('video/')) return true;
  return /\.(mp4|mov|webm|mkv|m4v|avi)$/i.test(item.name || '');
}

export function subscribeDriveAuth(listener: DriveAuthListener): () => void {
  listeners.add(listener);
  listener({ user: cachedFirebaseUser, token: cachedAccessToken });
  return () => {
    listeners.delete(listener);
  };
}

export function initDriveAuth(
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) {
  return onAuthStateChanged(auth, (user) => {
    cachedFirebaseUser = user;
    if (user && cachedAccessToken) {
      onAuthSuccess?.(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
    notifyDriveAuthListeners();
  });
}

export async function signInWithGoogleDrive(): Promise<{
  user: FirebaseUser;
  accessToken: string;
}> {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain Google Drive access token. Please try signing in again.');
    }
    cachedAccessToken = credential.accessToken;
    cachedFirebaseUser = result.user;
    notifyDriveAuthListeners();
    return { user: result.user, accessToken: cachedAccessToken };
  } finally {
    isSigningIn = false;
  }
}

export async function disconnectGoogleDrive(): Promise<void> {
  cachedAccessToken = null;
  cachedFirebaseUser = null;
  notifyDriveAuthListeners();
  await auth.signOut();
}

export function getDriveAccessToken(): string | null {
  return cachedAccessToken;
}

export function getDriveUser(): FirebaseUser | null {
  return cachedFirebaseUser;
}

function handleDriveAuthError(status: number) {
  if (status === 401) {
    cachedAccessToken = null;
    notifyDriveAuthListeners();
    throw new Error('Google Drive session expired. Please click Sign in with Google again.');
  }
}

export async function getDriveItemMetadata(fileOrFolderId: string): Promise<DriveFileItem> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('Google Drive is not connected. Sign in with Google first.');
  }
  const params = new URLSearchParams({
    fields: 'id,name,mimeType,webViewLink,size,parents',
    supportsAllDrives: 'true',
  });
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileOrFolderId)}?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  handleDriveAuthError(res.status);
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.error?.message || `Unable to access Google Drive item (${res.status})`);
  }
  return (await res.json()) as DriveFileItem;
}

export async function listDriveFolderContents(
  folderId: string = 'root',
  searchQuery?: string
): Promise<DriveFileItem[]> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('Google Drive is not connected. Sign in with Google first.');
  }

  let q = `trashed = false and ('${folderId}' in parents)`;
  if (searchQuery && searchQuery.trim()) {
    const safeSearch = searchQuery.trim().replace(/'/g, "\\'");
    q = `trashed = false and name contains '${safeSearch}'`;
  }

  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,mimeType,webViewLink,size,parents)',
    orderBy: 'folder,name',
    pageSize: '100',
    includeItemsFromAllDrives: 'true',
    supportsAllDrives: 'true',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  handleDriveAuthError(res.status);
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.error?.message || `Google Drive API error (${res.status})`);
  }

  const data = await res.json();
  return (data.files || []) as DriveFileItem[];
}

export async function scanDriveFolderVideos(
  folderId: string,
  rootFolderName?: string
): Promise<DriveFileItem[]> {
  const topItems = await listDriveFolderContents(folderId);
  const collected: DriveFileItem[] = [];

  const directVideos = topItems.filter((item) => isVideoDriveItem(item));
  for (const vid of directVideos) {
    collected.push({ ...vid, folderName: rootFolderName || 'Course Videos' });
  }

  const subFolders = topItems.filter(
    (item) => item.mimeType === 'application/vnd.google-apps.folder'
  );

  for (const sub of subFolders) {
    const subItems = await listDriveFolderContents(sub.id);
    for (const item of subItems) {
      if (isVideoDriveItem(item)) {
        collected.push({ ...item, folderName: sub.name });
      } else if (item.mimeType === 'application/vnd.google-apps.folder') {
        const nestedItems = await listDriveFolderContents(item.id);
        for (const nested of nestedItems) {
          if (isVideoDriveItem(nested)) {
            collected.push({ ...nested, folderName: `${sub.name} / ${item.name}` });
          }
        }
      }
    }
  }

  return collected;
}

export async function shareDriveFileWithEmail(
  fileId: string,
  studentEmail: string
): Promise<void> {
  const token = cachedAccessToken;
  if (!token) {
    throw new Error('Google Drive is not connected. Sign in with Google first.');
  }

  const params = new URLSearchParams({
    sendNotificationEmail: 'true',
    supportsAllDrives: 'true',
  });

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?${params.toString()}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'user',
        emailAddress: studentEmail.trim().toLowerCase(),
      }),
    }
  );

  handleDriveAuthError(res.status);
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new Error(errBody?.error?.message || `Unable to share Drive access (${res.status})`);
  }
}

export function extractDriveFileId(urlOrId?: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match?.[1]) return match[1];
  const idParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParam?.[1]) return idParam[1];
  if (/^[a-zA-Z0-9_-]{18,}$/.test(trimmed)) return trimmed;
  return null;
}

export function extractDriveFolderId(urlOrId?: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) return folderMatch[1];
  const idParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParam?.[1]) return idParam[1];
  if (/^[a-zA-Z0-9_-]{18,}$/.test(trimmed)) return trimmed;
  return null;
}

export function buildDrivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

export function buildDriveViewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}
