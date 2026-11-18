import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiFetch, getStoredToken, setStoredToken } from '../lib/api';
import { testSupabaseBrowserConnection, fetchSupabaseCourses, fetchSupabaseCategories } from '../lib/supabase';
import type { PublicBootstrap, User } from '../types';

export type RoutePath = string;

interface AppContextValue {
  user: User | null;
  authLoading: boolean;
  bootstrap: PublicBootstrap | null;
  currentPath: string;
  theme: 'light' | 'dark' | 'emerald';
  supabaseConnected: boolean;
  supabaseLatency: number;
  toggleTheme: () => void;
  setThemeMode: (mode: 'light' | 'dark' | 'emerald') => void;
  navigate: (path: string) => void;
  setUserSession: (user: User, token?: string) => void;
  refreshBootstrap: () => Promise<void>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [bootstrap, setBootstrap] = useState<PublicBootstrap | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [supabaseLatency, setSupabaseLatency] = useState(0);
  const [currentPath, setCurrentPath] = useState<string>(() => window.location.pathname || '/');
  const [theme, setTheme] = useState<'light' | 'dark' | 'emerald'>(() => {
    try {
      const saved = localStorage.getItem('ek_theme');
      if (saved === 'dark' || saved === 'light' || saved === 'emerald') return saved;
    } catch {
      // ignore
    }
    return 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'emerald');
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'emerald') {
      root.classList.add('emerald');
    }
    try {
      localStorage.setItem('ek_theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'emerald';
      return 'light';
    });
  }, []);

  const setThemeMode = useCallback((mode: 'light' | 'dark' | 'emerald') => {
    setTheme(mode);
  }, []);

  const navigate = useCallback((path: string) => {
    if (path !== window.location.pathname) {
      window.history.pushState({}, '', path);
    }
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPop = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const refreshBootstrap = useCallback(async () => {
    const data = await apiFetch<PublicBootstrap>('/api/public/bootstrap');
    setBootstrap(data);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const token = getStoredToken();
      if (!token) {
        // Still try cookie-based /api/auth/me in case cookie is active
      }
      const data = await apiFetch<{ user: User }>('/api/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBootstrap();
    refreshUser();

    testSupabaseBrowserConnection()
      .then((probe) => {
        if (probe.connected) {
          setSupabaseConnected(true);
          setSupabaseLatency(probe.latencyMs);
        }
      })
      .catch(() => {
        setSupabaseConnected(false);
      });
  }, [refreshBootstrap, refreshUser]);

  const setUserSession = useCallback(
    (nextUser: User, token?: string) => {
      if (token) setStoredToken(token);
      setUser(nextUser);
      refreshBootstrap().catch(() => undefined);
    },
    [refreshBootstrap]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setStoredToken(null);
    setUser(null);
    refreshBootstrap().catch(() => undefined);
    navigate('/');
  }, [navigate, refreshBootstrap]);

  return (
    <AppContext.Provider
      value={{
        user,
        authLoading,
        bootstrap,
        currentPath,
        theme,
        supabaseConnected,
        supabaseLatency,
        toggleTheme,
        setThemeMode,
        navigate,
        setUserSession,
        refreshBootstrap,
        refreshUser,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
