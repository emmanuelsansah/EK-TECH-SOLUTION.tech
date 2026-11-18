import React, { useState } from 'react';
import { Cpu, Download, FileText, Menu, MessageCircle, Moon, Sun, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export function PublicShell({ children }: { children: React.ReactNode }) {
  const { user, bootstrap, currentPath, navigate, theme, toggleTheme } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const settings = bootstrap?.settings;
  const whatsappNumber = (settings?.whatsappNumber || '0551464715').replace(/^0/, '233');

  const dashboardPath =
    user?.role === 'SUPER_ADMIN'
      ? '/admin'
      : user?.role === 'INSTRUCTOR'
      ? '/instructor'
      : '/student';

  const navLinks = [
    { label: 'Courses', path: '/courses' },
    { label: 'AI Training', path: '/ai-training' },
    { label: 'Instructors', path: '/instructors' },
    { label: 'About', path: '/about' },
    { label: 'Contact', path: '/contact' },
  ];

  const handleNav = (path: string) => {
    setMobileOpen(false);
    navigate(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#111827] dark:bg-[#0D1117] dark:text-slate-100">
      {/* Crisp White Header Matching Reference Layout */}
      <header className="sticky top-0 z-40 border-b border-[#EFEAE4] dark:border-slate-800 bg-white/95 dark:bg-[#0D1117]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Peach Icon + Single-line Wordmark */}
          <button
            type="button"
            onClick={() => handleNav('/')}
            className="inline-flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-[#111827] dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <img
              src="/assets/aistudio/WhatsApp_Image_2026-11-16_at_10.59.39_PM_55851518.jpeg"
              alt="EK TECH SOLUTIONS Logo"
              className="w-14 h-14 rounded-2xl object-cover bg-white dark:bg-slate-900 border-2 border-orange-500/30 dark:border-orange-400/30 p-0.5 shrink-0 shadow-md"
            />
            <span>EK TECH SOLUTIONS</span>
          </button>

          {/* Zone 2: 5 concise single-line nav links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#4B5563] dark:text-slate-300">
            {navLinks.map((link) => {
              const active = currentPath === link.path;
              return (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => handleNav(link.path)}
                  className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
                    active
                      ? 'text-[#EA580C] dark:text-orange-400 font-semibold border-b-2 border-[#EA580C] dark:border-orange-400'
                      : 'hover:text-[#111827] dark:hover:text-white'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Sign in + Primary Action */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {!user && (
              <button
                type="button"
                onClick={() => handleNav('/login')}
                className="hidden sm:inline-flex text-sm font-medium text-[#374151] dark:text-slate-300 hover:text-[#111827] dark:hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign in
              </button>
            )}
            <button
              type="button"
              onClick={() => handleNav(user ? dashboardPath : '/register')}
              className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {user ? 'Open Dashboard' : 'Join Now'}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="md:hidden p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-[#FFF7F0] dark:hover:bg-slate-800"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileOpen && (
          <div className="md:hidden border-t border-[#EFEAE4] dark:border-slate-800 bg-white dark:bg-[#0D1117] px-4 py-4 space-y-2">
            {navLinks.map((link) => (
              <button
                key={link.path}
                type="button"
                onClick={() => handleNav(link.path)}
                className="block w-full text-left px-3 py-2.5 text-sm font-medium text-[#374151] dark:text-slate-200 hover:bg-[#FFF7F0] dark:hover:bg-slate-800 rounded-xl"
              >
                {link.label}
              </button>
            ))}
            <div className="pt-2 border-t border-[#EFEAE4] dark:border-slate-800 flex items-center justify-between gap-2">
              {user ? (
                <button
                  type="button"
                  onClick={() => handleNav(dashboardPath)}
                  className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#EA580C] rounded-xl"
                >
                  Open Dashboard
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => handleNav('/login')}
                    className="flex-1 py-2.5 text-sm font-medium text-[#374151] dark:text-slate-200 border border-[#E5E7EB] dark:border-slate-700 rounded-xl"
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNav('/register')}
                    className="flex-1 py-2.5 text-sm font-semibold text-white bg-[#EA580C] rounded-xl"
                  >
                    Join Now
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Academy Footer */}
      <footer className="border-t border-[#EFE7DF] dark:border-slate-800 bg-[#111827] text-slate-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            <div className="space-y-4">
              <div className="text-lg font-extrabold tracking-tight text-white">EK TECH SOLUTIONS</div>
              <p className="text-sm text-slate-400 leading-relaxed">
                {settings?.tagline || 'Learn Technology. Build with AI. Create the Future.'}
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-200 border border-slate-700 hover:border-orange-500/60 rounded-xl transition-colors cursor-pointer"
                >
                  {theme === 'dark' ? (
                    <Sun className="w-3.5 h-3.5 text-orange-400" />
                  ) : theme === 'emerald' ? (
                    <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Moon className="w-3.5 h-3.5 text-orange-400" />
                  )}
                  <span>
                    {theme === 'light'
                      ? 'Theme: Light'
                      : theme === 'dark'
                      ? 'Theme: Dark'
                      : 'Theme: Emerald'}
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Specialized Tracks</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <button type="button" onClick={() => navigate('/ai-training')} className="hover:text-white cursor-pointer">
                    AI Training
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/ai-website-development')}
                    className="hover:text-white cursor-pointer"
                  >
                    AI Website Development
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/ai-video-creation')}
                    className="hover:text-white cursor-pointer"
                  >
                    AI Video Creation
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/courses')} className="hover:text-white cursor-pointer">
                    All Academy Courses
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Academy &amp; Admissions</h3>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>
                  <button type="button" onClick={() => navigate('/about')} className="hover:text-white cursor-pointer">
                    About Us
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/instructors')} className="hover:text-white cursor-pointer">
                    Instructors
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/register')} className="hover:text-white cursor-pointer">
                    Student Registration
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/login')} className="hover:text-white cursor-pointer">
                    Student Login
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => navigate('/faq')} className="hover:text-white cursor-pointer">
                    Frequently Asked Questions
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Payments &amp; Support</h3>
              <div className="space-y-2 text-sm text-slate-400">
                <p>
                  MTN Mobile Money: <span className="font-mono text-orange-400">{settings?.momoNumber || '0257460536'}</span>
                </p>
                <p>
                  WhatsApp Desk: <span className="font-mono text-white">{settings?.whatsappNumber || '0551464715'}</span>
                </p>
                <p>{settings?.supportEmail || 'admissions@ektechsolutions.com'}</p>
              </div>
              <div className="pt-2 flex flex-col gap-2">
                <a
                  href="/downloads/EK_TECH_SOLUTIONS_Architecture_Report.docx"
                  download="EK_TECH_SOLUTIONS_Architecture_Report.docx"
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold shadow-sm transition-all w-fit cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Architecture Report (Word .docx)</span>
                </a>
                <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                  <button type="button" onClick={() => navigate('/terms')} className="hover:text-white cursor-pointer">
                    Terms &amp; Conditions
                  </button>
                  <button type="button" onClick={() => navigate('/privacy')} className="hover:text-white cursor-pointer">
                    Privacy Policy
                  </button>
                  <button type="button" onClick={() => navigate('/contact')} className="hover:text-white cursor-pointer">
                    Contact Us
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} EK TECH SOLUTIONS Online Academy. All rights reserved.</p>
            <div>
              <p>Currency: Ghana Cedis (GH₵) · Online &amp; Recorded Cohort Training</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Compact WhatsApp Floating Contact Button */}
      <a
        href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
          'Hello EK TECH SOLUTIONS, I would like information about enrolling in a course.'
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contact EK TECH SOLUTIONS on WhatsApp"
        className="no-print fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-lg transition-transform hover:scale-105"
      >
        <MessageCircle className="w-4 h-4 shrink-0" />
        <span className="whitespace-nowrap">WhatsApp 0551464715</span>
      </a>
    </div>
  );
}
