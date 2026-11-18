import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { PublicShell } from './components/PublicShell';
import {
  AboutPage,
  AllCoursesPage,
  AuthPage,
  ContactPage,
  CourseDetailsPage,
  FaqPage,
  HomePage,
  InstructorsPage,
  LegalPage,
  TrackShowcasePage,
} from './pages/PublicPages';
import { StudentDashboard } from './pages/StudentDashboard';
import { InstructorDashboard } from './pages/InstructorDashboard';
import { AdminDashboard } from './pages/AdminDashboard';

function RouteSwitch() {
  const { currentPath, user, authLoading, navigate } = useApp();
  const cleanPath = currentPath.split('?')[0].replace(/\/+$/, '') || '/';

  // Protected Role Dashboards
  if (cleanPath === '/student') {
    if (authLoading) return <LoadingSplash />;
    if (!user) return <RedirectToLogin />;
    return <StudentDashboard />;
  }

  if (cleanPath === '/instructor') {
    if (authLoading) return <LoadingSplash />;
    if (!user) return <RedirectToLogin />;
    if (user.role !== 'INSTRUCTOR' && user.role !== 'SUPER_ADMIN') {
      return (
        <PublicShell>
          <AccessDeniedView onBack={() => navigate('/student')} />
        </PublicShell>
      );
    }
    return <InstructorDashboard />;
  }

  if (cleanPath === '/admin') {
    if (authLoading) return <LoadingSplash />;
    if (!user) return <RedirectToLogin />;
    if (user.role !== 'SUPER_ADMIN') {
      return (
        <PublicShell>
          <AccessDeniedView
            onBack={() => navigate(user.role === 'INSTRUCTOR' ? '/instructor' : '/student')}
          />
        </PublicShell>
      );
    }
    return <AdminDashboard />;
  }

  // Public Website Pages
  let pageContent: React.ReactNode;

  if (cleanPath === '/') {
    pageContent = <HomePage />;
  } else if (cleanPath === '/about') {
    pageContent = <AboutPage />;
  } else if (cleanPath === '/courses') {
    const params = new URLSearchParams(window.location.search);
    pageContent = <AllCoursesPage initialCategorySlug={params.get('category') || undefined} />;
  } else if (cleanPath.startsWith('/courses/')) {
    const slug = cleanPath.slice('/courses/'.length);
    pageContent = <CourseDetailsPage slug={slug} />;
  } else if (cleanPath === '/ai-training') {
    pageContent = <TrackShowcasePage track="ai-training" />;
  } else if (cleanPath === '/ai-website-development') {
    pageContent = <TrackShowcasePage track="ai-website-development" />;
  } else if (cleanPath === '/ai-video-creation') {
    pageContent = <TrackShowcasePage track="ai-video-creation" />;
  } else if (cleanPath === '/instructors') {
    pageContent = <InstructorsPage />;
  } else if (cleanPath === '/contact') {
    pageContent = <ContactPage />;
  } else if (cleanPath === '/register') {
    pageContent = <AuthPage mode="register" />;
  } else if (cleanPath === '/login') {
    pageContent = <AuthPage mode="login" />;
  } else if (cleanPath === '/forgot-password') {
    pageContent = <AuthPage mode="forgot" />;
  } else if (cleanPath === '/terms') {
    pageContent = <LegalPage type="terms" />;
  } else if (cleanPath === '/privacy') {
    pageContent = <LegalPage type="privacy" />;
  } else if (cleanPath === '/faq') {
    pageContent = <FaqPage />;
  } else {
    pageContent = <HomePage />;
  }

  return <PublicShell>{pageContent}</PublicShell>;
}

function LoadingSplash() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFFBF7] dark:bg-[#0D1117] text-sm text-[#4B5563] dark:text-slate-400">
      Loading EK TECH SOLUTIONS Online Academy...
    </div>
  );
}

function RedirectToLogin() {
  return (
    <PublicShell>
      <AuthPage mode="login" />
    </PublicShell>
  );
}

function AccessDeniedView({ onBack }: { onBack: () => void }) {
  return (
    <div className="max-w-lg mx-auto px-6 py-24 text-center space-y-4">
      <h1 className="text-2xl font-extrabold text-[#111827] dark:text-white">Access Restricted</h1>
      <p className="text-sm text-[#4B5563] dark:text-slate-300">
        Your current account role does not have permission to open this dashboard.
      </p>
      <button
        type="button"
        onClick={onBack}
        className="px-5 py-2.5 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer transition-colors"
      >
        Return to My Portal
      </button>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <RouteSwitch />
    </AppProvider>
  );
}
