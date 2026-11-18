import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code2,
  Film,
  GraduationCap,
  KeyRound,
  Layers,
  Lock,
  Mail,
  MapPin,
  Moon,
  Phone,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Sun,
  Users,
  Video,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { getSupabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { CourseThumbnail, MoMoPaymentModal } from '../components/UiPrimitives';
import type { Course, EmailPreviewPayload, Lesson, Module, User } from '../types';

export function CourseCard({
  course,
  categoryName,
  instructorName,
  onOpen,
}: {
  course: Course;
  categoryName: string;
  instructorName: string;
  onOpen: () => void;
}) {
  return (
    <article className="group flex flex-col rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-[#161B22] overflow-hidden shadow-[0_6px_24px_rgba(17,24,39,0.04)] transition-all hover:border-[#EA580C]/50 hover:shadow-[0_12px_32px_rgba(17,24,39,0.07)]">
      <div className="relative aspect-[4/3] overflow-hidden bg-[#FFF7F0] dark:bg-slate-800">
        <CourseThumbnail
          src={course.thumbnailUrl}
          alt={course.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-[#6B7280] dark:text-slate-400">
            <span className="font-semibold text-[#EA580C] dark:text-orange-400">{categoryName}</span>
            <span aria-hidden="true">·</span>
            <span>{course.duration}</span>
            <span aria-hidden="true">·</span>
            <span>{course.difficulty}</span>
          </div>
          <h3 className="text-base font-bold text-[#111827] dark:text-white leading-snug">
            {course.title}
          </h3>
          <p className="text-sm text-[#4B5563] dark:text-slate-300 line-clamp-2 leading-relaxed">
            {course.summary}
          </p>
        </div>

        <div className="pt-4 border-t border-[#F3ECE6] dark:border-slate-800 flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-[#6B7280] dark:text-slate-400">{instructorName}</div>
            <div className="text-base font-bold font-mono tabular-nums text-[#111827] dark:text-white">
              {course.isFree || course.priceGhs === 0 ? 'Free' : `GH₵ ${course.priceGhs}`}
            </div>
          </div>
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>View Course</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}

// ============================================================================
// 1. HOME PAGE
// ============================================================================
export function HomePage() {
  const { bootstrap, navigate, user, theme, toggleTheme } = useApp();
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({ senderName: '', senderEmail: '', subject: '', body: '' });
  const [contactStatus, setContactStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [contactMsg, setContactMsg] = useState('');

  if (!bootstrap) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-24 space-y-8 animate-pulse">
        <div className="h-12 w-2/3 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="h-72 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    );
  }

  const { categories, courses, instructors, website, settings, stats } = bootstrap;
  const featuredCourses = courses.filter((c) => c.isFeatured).slice(0, 4);
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
  const instructorMap = new Map(instructors.map((i) => [i.id, i.fullName]));

  const handleQuickContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactStatus('sending');
    try {
      await apiFetch('/api/public/contact', {
        method: 'POST',
        body: JSON.stringify(contactForm),
      });
      setContactStatus('sent');
      setContactMsg('Your message has been delivered to our Admissions Desk.');
      setContactForm({ senderName: '', senderEmail: '', subject: '', body: '' });
    } catch (err: any) {
      setContactStatus('error');
      setContactMsg(err.message || 'Unable to send message.');
    }
  };

  return (
    <div>
      {/* Warm Cream Hero Section Matching Reference Aesthetic */}
      <section className="bg-[#FFF7F0] dark:bg-[#0D1117] border-b border-[#F3E8DE] dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div className="text-xs font-bold tracking-[0.12em] uppercase text-[#C2410C] dark:text-orange-400">
                A BETTER WAY TO LEARN &amp; BUILD WITH AI
              </div>
              <h1
                className="font-extrabold tracking-[-0.03em] text-[#111827] dark:text-white leading-[1.06]"
                style={{ fontSize: 'clamp(2.5rem, 4.4vw, 3.75rem)', textWrap: 'balance' }}
              >
                Master the future with{' '}
                <span className="text-[#EA580C] dark:text-orange-400">AI &amp; technology.</span>
              </h1>
              <p className="text-base sm:text-lg text-[#4B5563] dark:text-slate-300 leading-relaxed max-w-lg">
                Learn AI website development, video creation, and practical digital skills with structured lessons
                taught by {instructors[0]?.fullName || 'Emmanuel Sansah'}.
              </p>
              <div className="flex flex-wrap items-center gap-6 pt-1">
                <button
                  type="button"
                  onClick={() => navigate('/courses')}
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl shadow-xs transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span>Explore courses</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate(user ? '/student' : '/register')}
                  className="text-sm font-semibold text-[#111827] dark:text-slate-100 hover:text-[#EA580C] dark:hover:text-orange-400 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {user ? 'Open your dashboard' : 'Create your account'}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-6 pt-2 text-xs font-medium text-[#4B5563] dark:text-slate-400">
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#EA580C] dark:text-orange-400 shrink-0" />
                  <span>Free Lesson 1 on login</span>
                </span>
                <span className="inline-flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#EA580C] dark:text-orange-400 shrink-0" />
                  <span>GH₵ 50 MTN MoMo enrolment ({settings.momoNumber})</span>
                </span>
              </div>
            </div>

            {/* Right Visual: Soft Peach Circle + Crisp Geometric Studio Illustration + Floating Verification Card */}
            <div className="lg:col-span-6 flex items-center justify-center">
              <div className="relative w-full max-w-[440px] aspect-square flex items-center justify-center">
                {/* Soft Pastel Peach Backdrop Circle */}
                <div className="w-[82%] h-[82%] rounded-full bg-[#FFE8D6] dark:bg-[#231711] flex items-center justify-center relative">
                  {/* Small 4-point sparkles */}
                  <svg
                    className="w-5 h-5 text-[#EA580C] absolute -top-1 right-6"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 0L14.8 9.2L24 12L14.8 14.8L12 24L9.2 14.8L0 12L9.2 9.2Z" />
                  </svg>
                  <svg
                    className="w-3.5 h-3.5 text-[#EA580C] absolute bottom-14 -left-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M12 0L14.8 9.2L24 12L14.8 14.8L12 24L9.2 14.8L0 12L9.2 9.2Z" />
                  </svg>

                  {/* Official EK TECH SOLUTIONS Logo */}
                  <div className="w-[82%] h-[82%] rounded-3xl bg-white dark:bg-slate-900 border-2 border-orange-500/30 p-4 shadow-2xl flex items-center justify-center overflow-hidden">
                    <img
                      src="/assets/aistudio/WhatsApp_Image_2026-11-16_at_10.59.39_PM_55851518.jpeg"
                      alt="EK TECH SOLUTIONS Official Logo"
                      className="w-full h-full object-contain drop-shadow-md"
                    />
                  </div>
                </div>

                {/* Floating White Status Card Matching Reference Bottom-Right */}
                <div className="absolute bottom-6 right-0 sm:right-2 bg-white dark:bg-[#161B22] rounded-2xl border border-[#EFE7DF] dark:border-slate-700 shadow-[0_14px_34px_rgba(17,24,39,0.1)] px-4 py-3 flex items-center gap-3.5 max-w-[285px]">
                  <div className="w-10 h-10 rounded-xl bg-[#FFF0E5] dark:bg-[#2A190E] text-[#EA580C] dark:text-orange-400 flex items-center justify-center shrink-0">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-[#111827] dark:text-white truncate">
                      Skills, well taught.
                    </div>
                    <div className="text-[11px] text-[#6B7280] dark:text-slate-400 truncate">
                      Watch Lesson 1 free today
                    </div>
                  </div>
                  <div className="w-6 h-6 rounded-full border-2 border-emerald-500 text-emerald-500 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Column Metric Strip Below Hero Split */}
          <div className="mt-14 grid grid-cols-2 lg:grid-cols-4 gap-4 pt-8 border-t border-[#F0E4D8] dark:border-slate-800">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-[#EFE7DF] dark:border-slate-800 shadow-[0_4px_16px_rgba(17,24,39,0.03)]">
              <div className="text-2xl font-extrabold font-mono tabular-nums text-[#111827] dark:text-white">
                {stats.activeLearners}+
              </div>
              <div className="text-xs text-[#4B5563] dark:text-slate-400 mt-1">Active Academy Learners</div>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-[#EFE7DF] dark:border-slate-800 shadow-[0_4px_16px_rgba(17,24,39,0.03)]">
              <div className="text-2xl font-extrabold font-mono tabular-nums text-[#111827] dark:text-white">
                {stats.publishedCourses} Tracks
              </div>
              <div className="text-xs text-[#4B5563] dark:text-slate-400 mt-1">Structured Career Courses</div>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-[#EFE7DF] dark:border-slate-800 shadow-[0_4px_16px_rgba(17,24,39,0.03)]">
              <div className="text-2xl font-extrabold font-mono tabular-nums text-[#111827] dark:text-white">
                {stats.practicalModules} Lessons
              </div>
              <div className="text-xs text-[#4B5563] dark:text-slate-400 mt-1">Video &amp; PDF Study Modules</div>
            </div>
            <div className="p-5 rounded-2xl bg-white dark:bg-[#161B22] border border-[#EFE7DF] dark:border-slate-800 shadow-[0_4px_16px_rgba(17,24,39,0.03)]">
              <div className="text-2xl font-extrabold font-mono tabular-nums text-[#EA580C] dark:text-orange-400">
                {stats.completionRate}%
              </div>
              <div className="text-xs text-[#4B5563] dark:text-slate-400 mt-1">Project Completion Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Courses */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111827] dark:text-white">
              Featured Academy Courses
            </h2>
            <p className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300 max-w-2xl">
              Hands-on online cohorts and recorded tutorials designed to take you from beginner to paid practitioner.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/courses')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#EA580C] dark:text-orange-400 hover:underline whitespace-nowrap cursor-pointer"
          >
            <span>Browse all courses</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              categoryName={categoryMap.get(course.categoryId) || 'Technology'}
              instructorName={instructorMap.get(course.instructorId) || 'Academy Faculty'}
              onOpen={() => navigate(`/courses/${course.slug}`)}
            />
          ))}
        </div>
      </section>

      {/* Popular Learning Categories */}
      <section className="bg-[#FFF7F0] dark:bg-[#11161E] border-y border-[#F3E8DE] dark:border-slate-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111827] dark:text-white">
              Popular Learning Categories
            </h2>
            <p className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300">
              Eight practical disciplines covering modern artificial intelligence, software engineering, and creative media.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map((cat, idx) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => navigate(`/courses?category=${cat.slug}`)}
                className="text-left p-5 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-[#161B22] hover:border-[#EA580C]/60 shadow-[0_4px_16px_rgba(17,24,39,0.03)] transition-all space-y-2 cursor-pointer"
              >
                <div className="text-xs font-mono text-[#EA580C] dark:text-orange-400 font-semibold">
                  {String(idx + 1).padStart(2, '0')}
                </div>
                <h3 className="text-base font-bold text-[#111827] dark:text-white">{cat.name}</h3>
                <p className="text-xs text-[#4B5563] dark:text-slate-400 leading-relaxed line-clamp-2">
                  {cat.description}
                </p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose EK TECH SOLUTIONS & Training Process */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20 space-y-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111827] dark:text-white">
              Why Choose EK TECH SOLUTIONS?
            </h2>
            <p className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300 leading-relaxed">
              We bridge the gap between watching tutorials and delivering commercial projects with structured mentorship,
              local Mobile Money access, and verifiable credentials.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => navigate('/about')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#EA580C] dark:text-orange-400 hover:underline cursor-pointer"
              >
                <span>Read about our academy mission</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              {
                num: '01. Practical Curriculum',
                desc: 'Every module pairs HD recorded lessons with downloadable PDF checklists and hands-on capstone exercises.',
              },
              {
                num: '02. Instructor Feedback',
                desc: 'Submit assignments directly in your dashboard and receive detailed grading and actionable reviews.',
              },
              {
                num: '03. Accessible MoMo Enrolment',
                desc: 'Enrol seamlessly in Ghana Cedis (GH₵) via MTN Mobile Money (0257460536) with fast manual verification.',
              },
              {
                num: '04. Verified Certificates',
                desc: 'Earn official EK TECH SOLUTIONS certificates with unique serial numbers upon completing your assessments.',
              },
            ].map((item) => (
              <div
                key={item.num}
                className="p-6 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-[#161B22] shadow-[0_4px_16px_rgba(17,24,39,0.03)] space-y-2"
              >
                <h3 className="text-base font-bold text-[#111827] dark:text-white">{item.num}</h3>
                <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How Our Learning System Works / Our Training Process */}
        <div className="border-t border-[#EFE7DF] dark:border-slate-800 pt-14">
          <div className="max-w-2xl mb-8 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#111827] dark:text-white">
              How Our Learning System Works
            </h2>
            <p className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300">
              Our four-step training process takes you smoothly from registration to verified graduation.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: 'Step 01',
                title: 'Create Account & Pick Track',
                body: 'Register your student profile, watch the free Lesson 1 orientation video, and pick your track.',
              },
              {
                step: 'Step 02',
                title: 'Pay via MTN Mobile Money',
                body: `Send GH₵ 50 to ${settings.momoBusinessName} (${settings.momoNumber}) and submit your Transaction ID.`,
              },
              {
                step: 'Step 03',
                title: 'Unlock All Drive Videos',
                body: 'Receive full Learning Room & Google Drive video access directly on your sign-up email.',
              },
              {
                step: 'Step 04',
                title: 'Pass Quiz & Earn Certificate',
                body: 'Complete your final assessment and download your official EK TECH SOLUTIONS certificate.',
              },
            ].map((proc) => (
              <div key={proc.step} className="space-y-2 p-5 rounded-2xl bg-[#FFF7F0] dark:bg-[#161B22] border border-[#F3E8DE] dark:border-slate-800">
                <div className="text-xs font-mono font-semibold text-[#EA580C] dark:text-orange-400">
                  {proc.step}
                </div>
                <h3 className="text-base font-bold text-[#111827] dark:text-white">{proc.title}</h3>
                <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">{proc.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Student Testimonials */}
      <section className="bg-[#111827] text-white py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-10 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Student Outcomes &amp; Testimonials</h2>
            <p className="text-sm sm:text-base text-slate-300">
              Graduates applying AI website development, video production, and prompt systems in real client work.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {website.testimonials.map((t) => (
              <blockquote
                key={t.id}
                className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-6"
              >
                <p className="text-sm text-slate-200 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <footer className="pt-4 border-t border-slate-800">
                  <div className="text-sm font-bold text-white">{t.name}</div>
                  <div className="text-xs text-orange-400">
                    {t.role} · {t.organization}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{t.courseCompleted}</div>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ & Quick Contact Split */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold tracking-tight text-[#111827] dark:text-white">
                Frequently Asked Questions
              </h2>
              <p className="text-sm text-[#4B5563] dark:text-slate-300">
                Answers on Mobile Money verification, recorded modules, and certification.
              </p>
            </div>
            <div className="divide-y divide-[#EFE7DF] dark:divide-slate-800 border-y border-[#EFE7DF] dark:border-slate-800">
              {website.faqs.slice(0, 4).map((item) => {
                const isOpen = openFaq === item.id;
                return (
                  <div key={item.id} className="py-4">
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : item.id)}
                      className="w-full flex items-center justify-between gap-4 text-left font-semibold text-sm sm:text-base text-[#111827] dark:text-white cursor-pointer"
                    >
                      <span>{item.question}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <p className="mt-3 text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
                        {item.answer}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => navigate('/faq')}
              className="text-sm font-semibold text-[#EA580C] dark:text-orange-400 hover:underline cursor-pointer"
            >
              View all FAQs
            </button>
          </div>

          <div className="lg:col-span-5">
            <div className="p-6 sm:p-8 rounded-2xl border border-[#F3E8DE] dark:border-slate-800 bg-[#FFF7F0] dark:bg-[#161B22] space-y-5">
              <div>
                <h2 className="text-xl font-bold text-[#111827] dark:text-white">Contact Admissions</h2>
                <p className="text-xs text-[#4B5563] dark:text-slate-400 mt-1">
                  Send an inquiry or message us directly on WhatsApp ({settings.whatsappNumber}).
                </p>
              </div>
              {contactStatus === 'sent' && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
                  {contactMsg}
                </div>
              )}
              {contactStatus === 'error' && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                  {contactMsg}
                </div>
              )}
              <form onSubmit={handleQuickContact} className="space-y-3">
                <input
                  type="text"
                  required
                  placeholder="Your full name"
                  value={contactForm.senderName}
                  onChange={(e) => setContactForm({ ...contactForm, senderName: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#111827] dark:text-white"
                />
                <input
                  type="email"
                  required
                  placeholder="Email address"
                  value={contactForm.senderEmail}
                  onChange={(e) => setContactForm({ ...contactForm, senderEmail: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#111827] dark:text-white"
                />
                <input
                  type="text"
                  required
                  placeholder="Subject (e.g. Course inquiry)"
                  value={contactForm.subject}
                  onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#111827] dark:text-white"
                />
                <textarea
                  rows={3}
                  required
                  placeholder="How can we help you?"
                  value={contactForm.body}
                  onChange={(e) => setContactForm({ ...contactForm, body: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#111827] dark:text-white"
                />
                <button
                  type="submit"
                  disabled={contactStatus === 'sending'}
                  className="w-full py-3 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl transition-colors cursor-pointer"
                >
                  {contactStatus === 'sending' ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 2. ALL COURSES PAGE
// ============================================================================
export function AllCoursesPage({ initialCategorySlug }: { initialCategorySlug?: string }) {
  const { bootstrap, navigate } = useApp();
  const [search, setSearch] = useState('');
  const [categorySlug, setCategorySlug] = useState(initialCategorySlug || 'all');
  const [pricingFilter, setPricingFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');

  if (!bootstrap) return null;
  const { categories, courses, instructors } = bootstrap;
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const instructorMap = new Map(instructors.map((i) => [i.id, i.fullName]));

  const filtered = courses.filter((c) => {
    const cat = categoryMap.get(c.categoryId);
    if (categorySlug !== 'all' && cat?.slug !== categorySlug) return false;
    if (pricingFilter === 'free' && !c.isFree && c.priceGhs > 0) return false;
    if (pricingFilter === 'paid' && (c.isFree || c.priceGhs === 0)) return false;
    if (difficultyFilter !== 'all' && c.difficulty !== difficultyFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        (cat?.name.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] dark:text-white">
            All Academy Courses
          </h1>
        </div>
        <p className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300">
          Explore structured tutorials across AI, web development, video production, and digital skills.
        </p>
      </div>

      {/* Filters Toolbar */}
      <div className="p-4 rounded-2xl border border-[#F3E8DE] dark:border-slate-800 bg-[#FFF7F0] dark:bg-[#161B22] space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#111827] dark:text-white"
            />
          </div>

          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="px-3.5 py-2 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800 text-[#111827] dark:text-white"
          >
            <option value="all">All Difficulty Levels</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </select>

          <div className="flex items-center gap-1 p-1 bg-[#EFE4DA] dark:bg-slate-800 rounded-xl">
            {(['all', 'paid', 'free'] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPricingFilter(p)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors cursor-pointer ${
                  pricingFilter === p
                    ? 'bg-white dark:bg-slate-700 text-[#111827] dark:text-white shadow-sm'
                    : 'text-[#4B5563] dark:text-slate-400'
                }`}
              >
                {p === 'all' ? 'All Prices' : p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCategorySlug('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
              categorySlug === 'all'
                ? 'bg-[#EA580C] text-white border-[#EA580C]'
                : 'bg-white dark:bg-slate-800 text-[#374151] dark:text-slate-300 border-[#E7DDD4] dark:border-slate-700'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategorySlug(cat.slug)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors cursor-pointer ${
                categorySlug === cat.slug
                  ? 'bg-[#EA580C] text-white border-[#EA580C]'
                  : 'bg-white dark:bg-slate-800 text-[#374151] dark:text-slate-300 border-[#E7DDD4] dark:border-slate-700'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-[#EFE7DF] dark:border-slate-800">
          <p className="text-sm text-[#4B5563] dark:text-slate-400">No courses match your current filter.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setCategorySlug('all');
              setPricingFilter('all');
              setDifficultyFilter('all');
            }}
            className="mt-3 text-xs font-semibold text-[#EA580C] dark:text-orange-400 hover:underline cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              categoryName={categoryMap.get(course.categoryId)?.name || 'Technology'}
              instructorName={instructorMap.get(course.instructorId) || 'Academy Faculty'}
              onOpen={() => navigate(`/courses/${course.slug}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. COURSE DETAILS PAGE & ENROLMENT FLOW
// ============================================================================
export function CourseDetailsPage({ slug }: { slug: string }) {
  const { user, bootstrap, navigate } = useApp();
  const [detail, setDetail] = useState<{
    course: Course;
    category: { name: string } | null;
    instructor: User | null;
    modules: Module[];
    lessons: Lesson[];
    isEnrolled: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMoMoModal, setShowMoMoModal] = useState(false);
  const [enrollingFree, setEnrollingFree] = useState(false);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch(`/api/courses/${slug}`)
      .then((data) => {
        if (active) {
          setDetail(data);
          setError('');
        }
      })
      .catch((err) => {
        if (active) setError(err.message || 'Course not found');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug, user?.id]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-16 animate-pulse space-y-6">
        <div className="h-10 w-1/2 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-20 text-center space-y-4">
        <h1 className="text-2xl font-bold">{error || 'Course not found'}</h1>
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="px-4 py-2 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer transition-colors"
        >
          Browse All Courses
        </button>
      </div>
    );
  }

  const { course, category, instructor, modules, lessons, isEnrolled } = detail;
  const settings = bootstrap?.settings;

  const handleEnrolClick = async () => {
    if (!user) {
      navigate('/login');
      return;
    }
    if (isEnrolled) {
      navigate(`/student?room=${course.id}`);
      return;
    }
    if (course.isFree || course.priceGhs === 0) {
      setEnrollingFree(true);
      try {
        await apiFetch('/api/enrolments/free', {
          method: 'POST',
          body: JSON.stringify({ courseId: course.id }),
        });
        navigate(`/student?room=${course.id}`);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setEnrollingFree(false);
      }
      return;
    }
    setShowMoMoModal(true);
  };

  return (
    <div className="pb-16">
      {/* Header Banner */}
      <section className="bg-[#FFF7F0] dark:bg-[#11161E] border-b border-[#F3E8DE] dark:border-slate-800 py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#C2410C] dark:text-orange-400 font-semibold">
              <span>{category?.name || 'Technology Track'}</span>
              <span aria-hidden="true">·</span>
              <span>{course.difficulty}</span>
              <span aria-hidden="true">·</span>
              <span>{course.duration}</span>
              <span aria-hidden="true">·</span>
              <span>{lessons.length} Lessons</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight text-[#111827] dark:text-white">
              {course.title}
            </h1>
            <p className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300 leading-relaxed max-w-2xl">
              {course.description}
            </p>
            {instructor && (
              <div className="pt-2 flex items-center gap-3">
                <img
                  src={instructor.avatarUrl}
                  alt={instructor.fullName}
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-full object-cover object-top border border-[#E7DDD4] dark:border-slate-700"
                />
                <div>
                  <div className="text-sm font-bold text-[#111827] dark:text-white">{instructor.fullName}</div>
                  <div className="text-xs text-[#6B7280] dark:text-slate-400">{instructor.title}</div>
                </div>
              </div>
            )}
          </div>

          {/* Enrolment Card */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-white dark:bg-[#161B22] text-[#111827] dark:text-white border border-[#EFE7DF] dark:border-slate-800 overflow-hidden shadow-[0_14px_36px_rgba(17,24,39,0.08)]">
              <div className="aspect-[16/9] bg-[#FFF7F0] dark:bg-slate-800">
                <CourseThumbnail src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-medium text-[#6B7280] dark:text-slate-400">Course Tuition</span>
                  <span className="text-2xl font-extrabold font-mono tabular-nums text-[#111827] dark:text-white">
                    {course.isFree || course.priceGhs === 0 ? 'Free' : `GH₵ ${course.priceGhs.toFixed(2)}`}
                  </span>
                </div>

                {!course.isFree && course.priceGhs > 0 && (
                  <div className="p-3.5 rounded-xl bg-[#FFF7F0] dark:bg-slate-800/80 border border-[#F3E8DE] dark:border-slate-700 text-xs space-y-1">
                    <div className="font-semibold text-[#111827] dark:text-slate-200">
                      Pay via MTN Mobile Money
                    </div>
                    <div className="text-[#4B5563] dark:text-slate-300">
                      {settings?.momoBusinessName || 'EK TECH SOLUTIONS'} ·{' '}
                      <span className="font-mono font-semibold text-[#EA580C] dark:text-orange-400">
                        {settings?.momoNumber || '0257460536'}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={enrollingFree}
                  onClick={handleEnrolClick}
                  className="w-full py-3 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl transition-colors cursor-pointer"
                >
                  {isEnrolled
                    ? 'Enter Learning Room'
                    : !user
                    ? 'Sign In to Watch Free Lesson 1 & Enrol'
                    : course.isFree || course.priceGhs === 0
                    ? enrollingFree
                      ? 'Activating Enrolment...'
                      : 'Enrol Free Now'
                    : `Pay GH₵ ${course.priceGhs} via MTN MoMo`}
                </button>
                {user && !isEnrolled && !course.isFree && course.priceGhs > 0 && (
                  <button
                    type="button"
                    onClick={() => navigate(`/student?room=${course.id}`)}
                    className="w-full py-2.5 text-xs font-semibold text-[#EA580C] dark:text-orange-400 border border-[#FCD5BA] dark:border-slate-700 hover:bg-[#FFF7F0] dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                  >
                    Watch Lesson 1 Free Preview
                  </button>
                )}
                <p className="text-xs text-[#6B7280] dark:text-slate-400 text-center">
                  {course.completionRequirement}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Curriculum & Objectives */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          <div className="p-6 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-[#161B22] space-y-4">
            <h2 className="text-xl font-bold text-[#111827] dark:text-white">What You Will Learn</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {course.learningObjectives.map((obj, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-sm text-[#374151] dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-[#EA580C] dark:text-orange-400 shrink-0 mt-0.5" />
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#111827] dark:text-white">Course Curriculum</h2>
            {modules.map((mod) => {
              const modLessons = lessons.filter((l) => l.moduleId === mod.id);
              return (
                <div
                  key={mod.id}
                  className="rounded-2xl border border-[#EFE7DF] dark:border-slate-800 overflow-hidden bg-white dark:bg-[#161B22]"
                >
                  <div className="px-5 py-4 bg-[#FFF7F0] dark:bg-slate-900 border-b border-[#F3E8DE] dark:border-slate-800">
                    <h3 className="text-base font-bold text-[#111827] dark:text-white">{mod.title}</h3>
                    {mod.description && (
                      <p className="text-xs text-[#6B7280] dark:text-slate-400 mt-0.5">{mod.description}</p>
                    )}
                  </div>
                  <div className="divide-y divide-[#F3ECE6] dark:divide-slate-800">
                    {modLessons.map((les) => (
                      <div key={les.id} className="px-5 py-3.5 flex items-center justify-between gap-4 text-sm">
                        <div className="flex items-center gap-3 min-w-0">
                          {isEnrolled || les.isFreePreview ? (
                            <Play className="w-4 h-4 text-[#EA580C] dark:text-orange-400 shrink-0" />
                          ) : (
                            <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                          )}
                          <span className="truncate font-medium text-[#1F2937] dark:text-slate-200">
                            {les.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-[#6B7280] dark:text-slate-400 shrink-0 font-mono tabular-nums">
                          {les.isFreePreview && !isEnrolled && (
                            <span className="text-[#EA580C] dark:text-orange-400 font-sans font-semibold">
                              Preview
                            </span>
                          )}
                          <span>{les.durationMinutes} min</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-[#161B22] space-y-3">
            <h3 className="text-base font-bold text-[#111827] dark:text-white">Course Requirements</h3>
            <ul className="space-y-2 text-sm text-[#4B5563] dark:text-slate-300">
              {course.requirements.map((req, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-[#EA580C] dark:text-orange-400 font-bold">·</span>
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {showMoMoModal && (
        <MoMoPaymentModal
          course={course}
          onClose={() => setShowMoMoModal(false)}
          onSuccess={() => {
            // Keep confirmation visible inside modal until user clicks Return
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// 4. DEDICATED TRACK PAGES (AI TRAINING / AI WEB DEV / AI VIDEO CREATION)
// ============================================================================
export function TrackShowcasePage({
  track,
}: {
  track: 'ai-training' | 'ai-website-development' | 'ai-video-creation';
}) {
  const { bootstrap, navigate } = useApp();
  if (!bootstrap) return null;

  const config = {
    'ai-training': {
      title: 'Artificial Intelligence & Prompt Engineering Training',
      subtitle:
        'Practical AI literacy, structured prompt engineering, and workflow automation for professionals, educators, and business teams.',
      image: '/src/assets/images/course_ai_systems_1794843661238.jpg',
      slugs: ['artificial-intelligence', 'prompt-engineering', 'digital-marketing'],
      highlights: [
        'Structured 4-pillar prompt engineering for deterministic business & code output',
        'AI workflow automation for academic grading, curriculum planning, and customer support',
        'Data privacy, verification checkpoints, and institutional AI governance',
      ],
    },
    'ai-website-development': {
      title: 'AI Website Development Academy Track',
      subtitle:
        'Learn how to specify, build, connect databases to, and deploy high-converting commercial websites using React, TypeScript, and AI engineering workflows.',
      image: '/src/assets/images/course_ai_webdev_1794843660816.jpg',
      slugs: ['ai-website-development', 'web-development'],
      highlights: [
        'Turn client briefs into clean responsive grid architectures and UI tokens',
        'Build dynamic forms, authentication systems, and persistent REST APIs',
        'Deploy live client websites to Vercel with Supabase PostgreSQL databases',
      ],
    },
    'ai-video-creation': {
      title: 'AI Video Creation & Commercial Editing',
      subtitle:
        'Master generative video storyboarding, AI voice mastering, rhythmic timeline editing, and studio-grade adverts for brands and educators.',
      image: '/src/assets/images/course_ai_video_1794843660832.jpg',
      slugs: ['ai-video-creation', 'graphic-design'],
      highlights: [
        'Commercial script hooks and 6-frame visual storyboarding',
        'Consistent camera motion, lighting control, and generative B-roll scenes',
        'Broadcast loudness mixing, kinetic captions, and social ad formatting',
      ],
    },
  }[track];

  const categoryIds = new Set(
    bootstrap.categories.filter((c) => config.slugs.includes(c.slug)).map((c) => c.id)
  );
  const matchingCourses = bootstrap.courses.filter((c) => categoryIds.has(c.categoryId));
  const categoryMap = new Map(bootstrap.categories.map((c) => [c.id, c.name]));
  const instructorMap = new Map(bootstrap.instructors.map((i) => [i.id, i.fullName]));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-6 space-y-5">
          <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#C2410C] dark:text-orange-400">
            Specialized Career Track
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111827] dark:text-white">
            {config.title}
          </h1>
          <p className="text-base text-[#4B5563] dark:text-slate-300 leading-relaxed">{config.subtitle}</p>
          <ul className="space-y-2.5 pt-2">
            {config.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-[#374151] dark:text-slate-200">
                <CheckCircle2 className="w-4 h-4 text-[#EA580C] dark:text-orange-400 shrink-0 mt-0.5" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="px-6 py-3 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer"
            >
              Join This Track
            </button>
          </div>
        </div>
        <div className="lg:col-span-6">
          <div className="aspect-[4/3] rounded-2xl overflow-hidden border border-[#EFE7DF] dark:border-slate-800 shadow-[0_12px_32px_rgba(17,24,39,0.06)]">
            <img
              src={config.image}
              alt={config.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>

      <div className="space-y-6 pt-6 border-t border-[#EFE7DF] dark:border-slate-800">
        <h2 className="text-2xl font-bold text-[#111827] dark:text-white">Courses in This Track</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {matchingCourses.map((c) => (
            <CourseCard
              key={c.id}
              course={c}
              categoryName={categoryMap.get(c.categoryId) || 'Academy Track'}
              instructorName={instructorMap.get(c.instructorId) || 'Emmanuel Sansah'}
              onOpen={() => navigate(`/courses/${c.slug}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 5. ABOUT, INSTRUCTORS, CONTACT, FAQ, LEGAL
// ============================================================================
export function AboutPage() {
  const { bootstrap, navigate } = useApp();
  if (!bootstrap) return null;
  const { website } = bootstrap;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-12">
      <div className="space-y-4">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#C2410C] dark:text-orange-400">
          About EK TECH SOLUTIONS
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#111827] dark:text-white">
          {website.aboutTitle}
        </h1>
        <p className="text-base text-[#4B5563] dark:text-slate-300 leading-relaxed">
          EK TECH SOLUTIONS Online Academy is a modern technology training institute dedicated to equipping students,
          freelancers, educators, and entrepreneurs with high-income digital skills.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl border border-[#F3E8DE] dark:border-slate-800 bg-[#FFF7F0] dark:bg-[#161B22] space-y-2">
          <h2 className="text-lg font-bold text-[#111827] dark:text-white">Our Mission</h2>
          <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">{website.aboutMission}</p>
        </div>
        <div className="p-6 rounded-2xl border border-[#F3E8DE] dark:border-slate-800 bg-[#FFF7F0] dark:bg-[#161B22] space-y-2">
          <h2 className="text-lg font-bold text-[#111827] dark:text-white">Our Vision</h2>
          <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">{website.aboutVision}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          onClick={() => navigate('/courses')}
          className="px-5 py-2.5 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer"
        >
          Explore Courses
        </button>
        <button
          type="button"
          onClick={() => navigate('/contact')}
          className="px-5 py-2.5 text-sm font-semibold border border-[#E7DDD4] dark:border-slate-700 rounded-xl cursor-pointer"
        >
          Contact Our Team
        </button>
      </div>
    </div>
  );
}

export function InstructorsPage() {
  const { bootstrap, navigate } = useApp();
  if (!bootstrap) return null;
  const isSingle = bootstrap.instructors.length === 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10">
      <div className="max-w-2xl space-y-2">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-[#C2410C] dark:text-orange-400">
          Lead Faculty
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#111827] dark:text-white">
          Academy Instructor
        </h1>
        <p className="text-base text-[#4B5563] dark:text-slate-300">
          Learn directly from our founder and lead practitioner in AI Website Development, AI Video Creation, and Applied AI.
        </p>
      </div>

      <div className={isSingle ? 'grid grid-cols-1 gap-8' : 'grid grid-cols-1 md:grid-cols-3 gap-6'}>
        {bootstrap.instructors.map((inst) => {
          const assignedCourses = bootstrap.courses.filter((c) => c.instructorId === inst.id);
          return (
            <div
              key={inst.id}
              className={`rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-[#161B22] shadow-[0_8px_28px_rgba(17,24,39,0.05)] overflow-hidden ${
                isSingle ? 'grid grid-cols-1 lg:grid-cols-12' : 'flex flex-col'
              }`}
            >
              <div
                className={
                  isSingle
                    ? 'lg:col-span-5 aspect-[3/4] max-h-[540px] w-full bg-[#111827]'
                    : 'aspect-[3/4] bg-[#111827]'
                }
              >
                <img
                  src={inst.avatarUrl}
                  alt={inst.fullName}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-top"
                />
              </div>
              <div
                className={`${
                  isSingle ? 'lg:col-span-7 p-8 sm:p-10' : 'p-6 flex-1'
                } space-y-5 flex flex-col justify-between`}
              >
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-[#EA580C] dark:text-orange-400">
                    {inst.title} · {inst.location}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111827] dark:text-white">
                    {inst.fullName}
                  </h2>
                  <p className="text-sm sm:text-base text-[#4B5563] dark:text-slate-300 leading-relaxed">
                    {inst.bio}
                  </p>
                </div>
                <div className="pt-5 border-t border-[#F3ECE6] dark:border-slate-800 space-y-2.5">
                  <div className="text-xs font-semibold uppercase tracking-wider text-[#6B7280] dark:text-slate-400">
                    Courses Taught by {inst.fullName} ({assignedCourses.length})
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {assignedCourses.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => navigate(`/courses/${c.slug}`)}
                        className="p-3 rounded-xl border border-[#EFE7DF] dark:border-slate-800 hover:border-[#EA580C] text-left text-xs transition-colors cursor-pointer"
                      >
                        <div className="font-bold text-[#111827] dark:text-white">{c.title}</div>
                        <div className="text-[#EA580C] dark:text-orange-400 font-mono mt-0.5">
                          {c.isFree || c.priceGhs === 0 ? 'Free' : `GH₵ ${c.priceGhs}`}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ContactPage() {
  const { bootstrap } = useApp();
  const [form, setForm] = useState({ senderName: '', senderEmail: '', subject: '', body: '' });
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [feedback, setFeedback] = useState('');

  const settings = bootstrap?.settings;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    try {
      await apiFetch('/api/public/contact', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      try {
        await getSupabase().from('support_messages').insert({
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          sender_name: form.senderName,
          sender_email: form.senderEmail,
          recipient_role: 'SUPER_ADMIN',
          subject: form.subject || 'Website Inquiry',
          body: form.body,
          status: 'UNREAD',
        });
      } catch {
        // non-blocking
      }
      setStatus('sent');
      setFeedback('Message received! Our admissions team will respond shortly.');
      setForm({ senderName: '', senderEmail: '', subject: '', body: '' });
    } catch (err: any) {
      setStatus('error');
      setFeedback(err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div className="lg:col-span-5 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold text-[#111827] dark:text-white">Contact EK TECH SOLUTIONS</h1>
          <p className="text-sm text-[#4B5563] dark:text-slate-300">
            Reach out for course guidance, corporate training, or Mobile Money payment verification support.
          </p>
        </div>

        <div className="space-y-4 text-sm">
          <div className="p-4 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-[#161B22] space-y-1">
            <div className="font-semibold text-[#111827] dark:text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-[#EA580C] dark:text-orange-400" />
              <span>MTN Mobile Money &amp; WhatsApp</span>
            </div>
            <div className="font-mono text-[#4B5563] dark:text-slate-300">
              {settings?.momoNumber || '0257460536'} ({settings?.momoBusinessName || 'EK TECH SOLUTIONS'})
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-[#161B22] space-y-1">
            <div className="font-semibold text-[#111827] dark:text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#EA580C] dark:text-orange-400" />
              <span>Email Desk</span>
            </div>
            <div className="text-[#4B5563] dark:text-slate-300">
              {settings?.supportEmail || 'admissions@ektechsolutions.com'}
            </div>
          </div>
          <div className="p-4 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-[#161B22] space-y-1">
            <div className="font-semibold text-[#111827] dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#EA580C] dark:text-orange-400" />
              <span>Delivery Mode</span>
            </div>
            <div className="text-[#4B5563] dark:text-slate-300">
              Online Worldwide · Accra &amp; Regional Cohorts
            </div>
          </div>
        </div>
      </div>

      <div className="lg:col-span-7">
        <form
          onSubmit={submit}
          className="p-6 sm:p-8 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-[#FFF7F0] dark:bg-[#161B22] space-y-4"
        >
          <h2 className="text-xl font-bold text-[#111827] dark:text-white">Send a Direct Inquiry</h2>
          {status === 'sent' && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-sm">
              {feedback}
            </div>
          )}
          {status === 'error' && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm">
              {feedback}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Full Name</label>
              <input
                type="text"
                required
                value={form.senderName}
                onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Email Address</label>
              <input
                type="email"
                required
                value={form.senderEmail}
                onChange={(e) => setForm({ ...form, senderEmail: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Subject</label>
            <input
              type="text"
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Message</label>
            <textarea
              rows={5}
              required
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
            />
          </div>
          <button
            type="submit"
            disabled={status === 'sending'}
            className="px-6 py-3 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer"
          >
            {status === 'sending' ? 'Sending...' : 'Submit Inquiry'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function FaqPage() {
  const { bootstrap } = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  if (!bootstrap) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-[#111827] dark:text-white">Frequently Asked Questions</h1>
        <p className="text-sm text-[#4B5563] dark:text-slate-300">
          Everything you need to know about enrolling, Mobile Money payments, and certificates.
        </p>
      </div>
      <div className="divide-y divide-[#EFE7DF] dark:divide-slate-800 border-y border-[#EFE7DF] dark:border-slate-800">
        {bootstrap.website.faqs.map((faq) => {
          const open = openId === faq.id;
          return (
            <div key={faq.id} className="py-5">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : faq.id)}
                className="w-full flex items-center justify-between gap-4 text-left font-semibold text-[#111827] dark:text-white cursor-pointer"
              >
                <span>{faq.question}</span>
                <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <p className="mt-3 text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">{faq.answer}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LegalPage({ type }: { type: 'terms' | 'privacy' }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-6">
      <h1 className="text-3xl font-extrabold text-[#111827] dark:text-white">
        {type === 'terms' ? 'Terms and Conditions' : 'Privacy Policy'}
      </h1>
      {type === 'terms' ? (
        <div className="space-y-4 text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
          <p>
            Welcome to EK TECH SOLUTIONS Online Academy. By creating an account or enrolling in any course, you agree to
            abide by these academy terms.
          </p>
          <h2 className="text-base font-bold text-[#111827] dark:text-white">1. Enrolment &amp; Mobile Money Payments</h2>
          <p>
            Paid courses require transfer of the listed tuition in Ghana Cedis (GH₵) to our official MTN Mobile Money
            number (0257460536 — EK TECH SOLUTIONS). Access is granted strictly after manual administrator verification.
            Submitting duplicate, altered, or fraudulent transaction IDs is prohibited and results in account suspension.
          </p>
          <h2 className="text-base font-bold text-[#111827] dark:text-white">2. Intellectual Property</h2>
          <p>
            Tutorial videos, downloadable PDF guides, and source templates remain the intellectual property of EK TECH
            SOLUTIONS and are licensed solely for your personal learning and career projects.
          </p>
        </div>
      ) : (
        <div className="space-y-4 text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
          <p>
            EK TECH SOLUTIONS respects your privacy. We collect only the information required to manage your learning
            account, verify Mobile Money payments, grade coursework, and issue official certificates.
          </p>
          <h2 className="text-base font-bold text-[#111827] dark:text-white">1. Data We Collect</h2>
          <p>
            Account details (name, email, phone number), course progress, submitted assignments, and Mobile Money payment
            verification records (sender phone, transaction ID, optional receipt image).
          </p>
          <h2 className="text-base font-bold text-[#111827] dark:text-white">2. Security &amp; Confidentiality</h2>
          <p>
            Passwords are cryptographically hashed using scrypt. Payment verification proofs are accessible only to
            authorized Academy Administrators for transaction confirmation.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 6. AUTH PAGES (LOGIN, REGISTRATION, FORGOT PASSWORD)
// ============================================================================
function PasswordStrengthChecklist({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase (A-Z)', met: /[A-Z]/.test(password) },
    { label: 'Lowercase (a-z)', met: /[a-z]/.test(password) },
    { label: 'Number (0-9)', met: /[0-9]/.test(password) },
    { label: 'Symbol (!@#$...)', met: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.met).length;
  return (
    <div className="p-3 rounded-xl border border-[#EFE7DF] dark:border-slate-800 bg-[#FFFBF7] dark:bg-slate-900/60 space-y-2">
      <div className="flex items-center justify-between text-[11px] font-semibold">
        <span className="text-[#4B5563] dark:text-slate-400">CIA Password Integrity</span>
        <span
          className={
            score === 5
              ? 'text-emerald-600 dark:text-emerald-400'
              : score >= 3
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-[#6B7280] dark:text-slate-400'
          }
        >
          {score}/5 Requirements
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[11px]">
        {checks.map((c) => (
          <div
            key={c.label}
            className={`flex items-center gap-1.5 ${
              c.met
                ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                : 'text-[#6B7280] dark:text-slate-400'
            }`}
          >
            <CheckCircle2 className={`w-3 h-3 shrink-0 ${c.met ? 'opacity-100' : 'opacity-30'}`} />
            <span>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TwoFactorStepState {
  purpose: 'LOGIN' | 'REGISTER' | 'PASSWORD_RESET';
  challengeId: string;
  email: string;
  expiresInMinutes: number;
  deliveryMode?: string;
  emailPreview?: EmailPreviewPayload;
}

export function AuthPage({ mode }: { mode: 'login' | 'register' | 'forgot' }) {
  const { navigate, setUserSession } = useApp();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('Accra, Ghana');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [twoFactorStep, setTwoFactorStep] = useState<TwoFactorStepState | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setTwoFactorStep(null);
    setOtpCode('');
    setPassword('');
    setError('');
    setInfo('');
    setResendCooldown(0);
  }, [mode]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const routeAfterLogin = (role: string) => {
    if (role === 'SUPER_ADMIN') navigate('/admin');
    else if (role === 'INSTRUCTOR') navigate('/instructor');
    else navigate('/student');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (res.requires2FA && res.challengeId) {
        setTwoFactorStep({
          purpose: 'LOGIN',
          challengeId: res.challengeId,
          email: res.email || email,
          expiresInMinutes: res.expiresInMinutes || 10,
          deliveryMode: res.deliveryMode,
          emailPreview: res.emailPreview,
        });
        setOtpCode('');
        setResendCooldown(20);
        setInfo(res.message || `A 6-digit 2FA verification code has been sent to ${email}.`);
      } else if (res.user) {
        try {
          getSupabase().auth.signInWithPassword({ email, password }).catch(() => undefined);
        } catch {
          // non-blocking
        }
        setUserSession(res.user, res.token);
        routeAfterLogin(res.user.role);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, phone, location, password }),
      });
      if (res.requires2FA && res.challengeId) {
        setTwoFactorStep({
          purpose: 'REGISTER',
          challengeId: res.challengeId,
          email: res.email || email,
          expiresInMinutes: res.expiresInMinutes || 10,
          deliveryMode: res.deliveryMode,
          emailPreview: res.emailPreview,
        });
        setOtpCode('');
        setResendCooldown(20);
        setInfo(res.message || `A 6-digit verification code has been sent to ${email}.`);
      } else if (res.user) {
        try {
          getSupabase().auth.signUp({
            email,
            password,
            options: { data: { fullName, phone, location } },
          }).catch(() => undefined);
        } catch {
          // non-blocking
        }
        setUserSession(res.user, res.token);
        navigate('/student');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (!twoFactorStep) {
        const res = await apiFetch('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
        setInfo(res.message);
        if (res.challengeId) {
          setTwoFactorStep({
            purpose: 'PASSWORD_RESET',
            challengeId: res.challengeId,
            email,
            expiresInMinutes: res.expiresInMinutes || 15,
            deliveryMode: res.deliveryMode,
            emailPreview: res.emailPreview,
          });
          setOtpCode('');
          setPassword('');
          setResendCooldown(20);
        }
      } else {
        const res = await apiFetch('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({
            email: twoFactorStep.email,
            challengeId: twoFactorStep.challengeId,
            resetCode: otpCode.trim(),
            newPassword: password,
          }),
        });
        setInfo(res.message);
        setTwoFactorStep(null);
        setOtpCode('');
        setPassword('');
        setTimeout(() => navigate('/login'), 1200);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoFactorStep) return;
    setError('');
    setLoading(true);
    try {
      const endpoint =
        twoFactorStep.purpose === 'REGISTER' ? '/api/auth/register/verify' : '/api/auth/login/verify';
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          challengeId: twoFactorStep.challengeId,
          code: otpCode.trim(),
        }),
      });
      setUserSession(res.user, res.token);
      routeAfterLogin(res.user.role);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend2FA = async () => {
    if (!twoFactorStep || resendCooldown > 0) return;
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/resend-2fa', {
        method: 'POST',
        body: JSON.stringify({ challengeId: twoFactorStep.challengeId }),
      });
      setTwoFactorStep((prev) =>
        prev
          ? {
              ...prev,
              expiresInMinutes: res.expiresInMinutes || prev.expiresInMinutes,
              deliveryMode: res.deliveryMode || prev.deliveryMode,
              emailPreview: res.emailPreview,
            }
          : null
      );
      setResendCooldown(20);
      setInfo(res.message || 'A fresh 6-digit verification code was sent to your email.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="bg-[#FFF7F0] dark:bg-[#0D1117] py-14 px-4">
      <div className="max-w-md mx-auto">
        <div className="p-6 sm:p-8 rounded-2xl border border-[#EFE7DF] dark:border-slate-800 bg-white dark:bg-[#161B22] shadow-[0_12px_32px_rgba(17,24,39,0.06)] space-y-6">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#EA580C] dark:text-orange-400">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>CIA Security · Email 2FA</span>
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-[#111827] dark:text-white">
              {twoFactorStep
                ? twoFactorStep.purpose === 'REGISTER'
                  ? 'Verify Your Email (2FA)'
                  : twoFactorStep.purpose === 'PASSWORD_RESET'
                  ? 'Confirm 2FA & New Password'
                  : 'Two-Factor Sign-In Check'
                : mode === 'login'
                ? 'Academy Portal Sign In'
                : mode === 'register'
                ? 'Student Registration'
                : 'Reset Your Password'}
            </h1>
            <p className="text-xs text-[#4B5563] dark:text-slate-400">
              {twoFactorStep
                ? `Enter the 6-digit verification code sent to ${twoFactorStep.email} (valid ${twoFactorStep.expiresInMinutes} mins).`
                : mode === 'login'
                ? 'Password + 6-digit Email 2FA protects every student, instructor, and admin sign-in.'
                : mode === 'register'
                ? 'Verify your email with 2FA to unlock Lesson 1 free and protect your EK TECH account.'
                : 'We will email a 6-digit 2FA security code to verify your identity before changing your password.'}
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}
          {info && (
            <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
              <p>{info}</p>
            </div>
          )}

          {/* Email Outbox Preview shown ONLY when SMTP_* environment secrets are not configured */}
          {twoFactorStep?.emailPreview && (
            <div className="p-4 rounded-xl border border-[#FCD5BA] dark:border-orange-800 bg-[#FFF7F0] dark:bg-orange-950/30 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-bold text-[#EA580C] dark:text-orange-400">
                  <Mail className="w-3.5 h-3.5" />
                  <span>2FA Email Outbox Preview</span>
                </span>
                <span className="text-[11px] font-mono text-[#6B7280] dark:text-slate-400">
                  SMTP secret not set
                </span>
              </div>
              <div className="text-[11px] text-[#4B5563] dark:text-slate-300">
                To: <span className="font-mono">{twoFactorStep.emailPreview.to}</span> ·{' '}
                {twoFactorStep.emailPreview.subject}
              </div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="font-mono text-lg font-extrabold tracking-[0.2em] text-[#111827] dark:text-white">
                  {twoFactorStep.emailPreview.code}
                </span>
                <button
                  type="button"
                  onClick={() => setOtpCode(twoFactorStep.emailPreview!.code)}
                  className="px-2.5 py-1 text-[11px] font-semibold bg-[#EA580C] hover:bg-[#D44E07] text-white rounded-lg cursor-pointer"
                >
                  Auto-Fill Code
                </button>
              </div>
            </div>
          )}

          {/* TWO-FACTOR VERIFICATION FORM FOR LOGIN & REGISTRATION */}
          {twoFactorStep && twoFactorStep.purpose !== 'PASSWORD_RESET' && (
            <form onSubmit={handleVerifyTwoFactor} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">6-Digit Email 2FA Code *</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#6B7280] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    autoFocus
                    placeholder="Enter 6-digit code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full pl-10 pr-4 py-2.5 text-base font-mono tracking-[0.25em] rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || otpCode.length !== 6}
                className="w-full py-3 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] disabled:opacity-50 rounded-xl cursor-pointer"
              >
                {loading
                  ? 'Verifying 2FA Code...'
                  : twoFactorStep.purpose === 'REGISTER'
                  ? 'Verify Email & Create Account'
                  : 'Verify 2FA & Sign In'}
              </button>

              <div className="flex items-center justify-between text-xs pt-1">
                <button
                  type="button"
                  disabled={resendCooldown > 0 || loading}
                  onClick={handleResend2FA}
                  className="inline-flex items-center gap-1.5 text-[#EA580C] dark:text-orange-400 hover:underline disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>
                    {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend 2FA Email Code'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTwoFactorStep(null);
                    setOtpCode('');
                    setError('');
                    setInfo('');
                  }}
                  className="text-[#4B5563] dark:text-slate-300 hover:underline cursor-pointer"
                >
                  Back
                </button>
              </div>
            </form>
          )}

          {mode === 'login' && !twoFactorStep && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-[#EA580C] dark:text-orange-400 hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="text-[#4B5563] dark:text-slate-300 hover:underline cursor-pointer"
                >
                  Create student account
                </button>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer"
              >
                {loading ? 'Sending 2FA Email Code...' : 'Continue to 2FA Verification'}
              </button>

              <div className="pt-4 border-t border-[#EFE7DF] dark:border-slate-800 space-y-2">
                <div className="text-xs font-medium text-[#6B7280] dark:text-slate-400">
                  Quick Test Role Credentials
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => fillDemo('kofi.student@ektechsolutions.com', 'Student@2026!')}
                    className="py-1.5 px-2 text-xs font-medium border border-[#E7DDD4] dark:border-slate-700 rounded-xl hover:bg-[#FFF7F0] dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Student
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemo('emmanuelsansah020@gmail.com', 'Instructor@2026!')}
                    className="py-1.5 px-2 text-xs font-medium border border-[#E7DDD4] dark:border-slate-700 rounded-xl hover:bg-[#FFF7F0] dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Instructor
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemo('', 'admin')}
                    className="py-1.5 px-2 text-xs font-medium border border-[#E7DDD4] dark:border-slate-700 rounded-xl hover:bg-[#FFF7F0] dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Admin
                  </button>
                </div>
              </div>
            </form>
          )}

          {mode === 'register' && !twoFactorStep && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Phone / MoMo</label>
                  <input
                    type="tel"
                    placeholder="055..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">City / Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-xs font-medium">Strong Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <PasswordStrengthChecklist password={password} />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer"
              >
                {loading ? 'Sending Verification Email...' : 'Send 2FA Verification Email'}
              </button>
              <div className="text-center text-xs text-[#6B7280]">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-[#EA580C] dark:text-orange-400 font-semibold hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </div>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              {!twoFactorStep && (
                <div>
                  <label className="block text-xs font-medium mb-1">Registered Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              )}
              {twoFactorStep?.purpose === 'PASSWORD_RESET' && (
                <>
                  <div>
                    <label className="block text-xs font-medium mb-1">6-Digit Email 2FA Reset Code *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                      placeholder="Enter 6-digit code"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full px-3.5 py-2.5 text-base font-mono tracking-[0.25em] rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium">New Strong Password *</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#E7DDD4] dark:border-slate-700 bg-white dark:bg-slate-800"
                    />
                    <PasswordStrengthChecklist password={password} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || loading}
                      onClick={handleResend2FA}
                      className="inline-flex items-center gap-1 text-[#EA580C] dark:text-orange-400 hover:underline disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>
                        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend 2FA Reset Email'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTwoFactorStep(null);
                        setOtpCode('');
                        setPassword('');
                      }}
                      className="text-[#4B5563] dark:text-slate-300 hover:underline cursor-pointer"
                    >
                      Change Email
                    </button>
                  </div>
                </>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer"
              >
                {loading
                  ? 'Processing...'
                  : twoFactorStep?.purpose === 'PASSWORD_RESET'
                  ? 'Verify 2FA & Update Password'
                  : 'Send 2FA Reset Code to Email'}
              </button>
              <div className="text-center text-xs">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="text-[#EA580C] dark:text-orange-400 hover:underline cursor-pointer"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
