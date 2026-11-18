import React, { useState } from 'react';
import { Bell, LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

export function DashboardShell({
  roleLabel,
  navItems,
  activeTab,
  onSelectTab,
  unreadNotifications = 0,
  children,
}: {
  roleLabel: string;
  navItems: NavItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  unreadNotifications?: number;
  children: React.ReactNode;
}) {
  const { user, theme, toggleTheme, navigate, logout } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeItem = navItems.find((n) => n.id === activeTab);

  return (
    <div className="min-h-screen flex bg-[#FFFBF7] dark:bg-[#0D1117] text-[#111827] dark:text-slate-100">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-64 shrink-0 bg-[#111827] text-slate-200 border-r border-slate-800 flex flex-col transition-transform duration-200 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-left cursor-pointer flex items-center gap-2.5"
          >
            <img
              src="/assets/aistudio/WhatsApp_Image_2026-11-16_at_10.59.39_PM_55851518.jpeg"
              alt="EK TECH SOLUTIONS Logo"
              className="w-12 h-12 rounded-xl object-cover bg-white/15 border border-orange-400/40 p-0.5 shrink-0 shadow-md"
            />
            <div>
              <div className="text-sm font-extrabold tracking-tight text-white">EK TECH SOLUTIONS</div>
              <div className="text-[11px] text-orange-400 font-semibold">{roleLabel}</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="lg:hidden p-1.5 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-medium rounded-xl transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#EA580C] text-white'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <span className="shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="font-mono tabular-nums text-[11px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-800 space-y-1">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full text-left px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors cursor-pointer"
          >
            View Public Website
          </button>
          <button
            type="button"
            onClick={logout}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-950/50 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-16 bg-white dark:bg-[#161B22] border-b border-[#EFE7DF] dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-[#FFF7F0] dark:hover:bg-slate-800"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 truncate">
              <span>{roleLabel}</span>
              <span className="mx-2" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-[#111827] dark:text-white">
                {activeItem?.label || 'Overview'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle Light or Dark mode"
              className="p-2 rounded-xl border border-[#EFE7DF] dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-[#FFF7F0] dark:hover:bg-slate-800 cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-orange-400" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => onSelectTab('notifications')}
              aria-label="View notifications"
              className="relative p-2 rounded-xl border border-[#EFE7DF] dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-[#FFF7F0] dark:hover:bg-slate-800 cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#EA580C] text-white text-[10px] font-mono flex items-center justify-center">
                  {unreadNotifications}
                </span>
              )}
            </button>

            {user && (
              <div className="flex items-center gap-2.5 pl-2 border-l border-[#EFE7DF] dark:border-slate-800">
                <img
                  src={user.avatarUrl}
                  alt={user.fullName}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-full object-cover object-top border border-[#EFE7DF] dark:border-slate-700"
                />
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-[#111827] dark:text-white leading-none">
                    {user.fullName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{user.role}</div>
                </div>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
