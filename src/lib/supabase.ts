import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Category, Course, SystemSettings, WebsiteContent } from '../types';

export const DEFAULT_SUPABASE_PROJECT_REF = 'fimobcmrmdpxweaxitwq';
export const DEFAULT_SUPABASE_URL = 'https://fimobcmrmdpxweaxitwq.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbW9iY21ybWRweHdlYXhpdHdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4NTIwMTIsImV4cCI6MjExMDQyODAxMn0.jFxDgZjXfqdhWAXKKQYcFZEhsLfKCnlC23XYQLcKFjU';

/**
 * Normalizes Supabase API URL, removing trailing `/rest/v1` or trailing slashes if present.
 */
export function normalizeSupabaseUrl(rawUrl?: string): string {
  const url = (rawUrl || DEFAULT_SUPABASE_URL).trim();
  return url.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

export function getClientSupabaseUrl(): string {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
  return normalizeSupabaseUrl(envUrl || DEFAULT_SUPABASE_URL);
}

export function getClientSupabaseAnonKey(): string {
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  return (envKey || DEFAULT_SUPABASE_ANON_KEY).trim();
}

let _browserClient: SupabaseClient | null = null;

/**
 * Returns the singleton browser Supabase client configured with the verified Anon key.
 */
export function getSupabase(): SupabaseClient {
  if (!_browserClient) {
    const url = getClientSupabaseUrl();
    const key = getClientSupabaseAnonKey();
    _browserClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return _browserClient;
}

export const supabase = getSupabase();

export interface SupabaseClientProbeResult {
  connected: boolean;
  projectUrl: string;
  latencyMs: number;
  tablesVerified: string[];
  message: string;
  error?: string;
}

/**
 * Probes the Supabase project directly from the browser using the Anon key.
 */
export async function testSupabaseBrowserConnection(): Promise<SupabaseClientProbeResult> {
  const start = Date.now();
  const client = getSupabase();
  const projectUrl = getClientSupabaseUrl();
  const tablesVerified: string[] = [];

  try {
    const [catRes, courseRes, setRes] = await Promise.all([
      client.from('categories').select('id, name, slug').limit(3),
      client.from('courses').select('id, title, slug').limit(3),
      client.from('system_settings').select('id, academy_name').limit(1),
    ]);

    if (!catRes.error) tablesVerified.push('categories');
    if (!courseRes.error) tablesVerified.push('courses');
    if (!setRes.error) tablesVerified.push('system_settings');

    if (catRes.error && courseRes.error && setRes.error) {
      return {
        connected: false,
        projectUrl,
        latencyMs: Date.now() - start,
        tablesVerified,
        error: catRes.error?.message || courseRes.error?.message || 'Tables not accessible',
        message: 'Could not query Supabase tables. Ensure supabase/schema.sql is applied in your Supabase project.',
      };
    }

    return {
      connected: true,
      projectUrl,
      latencyMs: Date.now() - start,
      tablesVerified,
      message: `Successfully connected to Supabase REST API (${DEFAULT_SUPABASE_PROJECT_REF}) with Anon Key.`,
    };
  } catch (err: any) {
    return {
      connected: false,
      projectUrl,
      latencyMs: Date.now() - start,
      tablesVerified,
      error: err?.message || 'Connection failed',
      message: 'Failed to contact Supabase REST API from browser.',
    };
  }
}

/**
 * Optional client-side helper to query live categories directly from Supabase.
 */
export async function fetchSupabaseCategories(): Promise<Category[] | null> {
  try {
    const { data, error } = await getSupabase()
      .from('categories')
      .select('*')
      .order('order_index', { ascending: true });
    if (error || !data) return null;
    return data.map((r: any) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description || '',
      orderIndex: Number(r.order_index ?? 0),
    }));
  } catch {
    return null;
  }
}

/**
 * Optional client-side helper to query live published courses directly from Supabase.
 */
export async function fetchSupabaseCourses(): Promise<Course[] | null> {
  try {
    const { data, error } = await getSupabase()
      .from('courses')
      .select('*')
      .eq('is_published', true);
    if (error || !data) return null;
    return data.map((r: any) => ({
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
      createdAt: r.created_at,
    }));
  } catch {
    return null;
  }
}

/**
 * Real-time subscription helper for any public table.
 */
export function subscribeToSupabaseTable(
  table: string,
  onEvent: (payload: any) => void
): () => void {
  const channel = getSupabase()
    .channel(`public:${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
      onEvent(payload);
    })
    .subscribe();

  return () => {
    getSupabase().removeChannel(channel);
  };
}
