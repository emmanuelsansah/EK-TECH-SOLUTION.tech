import React, { useState } from 'react';
import PaystackPop from '@paystack/inline-js';
import {
  AlertCircle,
  Award,
  CheckCircle2,
  Clock,
  Cpu,
  CreditCard,
  ExternalLink,
  Printer,
  ShieldCheck,
  Smartphone,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useApp } from '../context/AppContext';
import type { Certificate, Course, PaymentStatus } from '../types';

export function CourseThumbnail({
  src,
  alt,
  className = 'w-full h-48 object-cover',
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#111827] via-[#1F2937] to-[#EA580C] text-white p-6 ${className}`}
      >
        <Cpu className="w-8 h-8 text-orange-300 mb-2" />
        <span className="text-xs font-medium text-slate-200 text-center line-clamp-2">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setErrored(true)}
      className={className}
    />
  );
}

export function StatusIndicator({ status }: { status: PaymentStatus | string }) {
  switch (status) {
    case 'APPROVED':
    case 'ACTIVE':
    case 'COMPLETED':
    case 'GRADED':
    case 'REPLIED':
    case 'RESOLVED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'PENDING':
    case 'SUBMITTED':
    case 'OPEN':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    case 'REJECTED':
    case 'SUSPENDED':
    case 'REVOKED':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{status}</span>
        </span>
      );
  }
}

export function MoMoPaymentModal({
  course,
  onClose,
  onSuccess,
}: {
  course: Course;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user, bootstrap, refreshBootstrap } = useApp();
  const settings = bootstrap?.settings;
  const gatewayMode = settings?.paymentGatewayMode || 'BOTH';
  const paystackAllowed = gatewayMode !== 'MANUAL_MOMO';
  const manualAllowed = gatewayMode !== 'PAYSTACK';
  const paystackConfigured = Boolean(bootstrap?.paystackConfigured);

  const [method, setMethod] = useState<'PAYSTACK' | 'MANUAL_MOMO'>(() =>
    paystackAllowed ? 'PAYSTACK' : 'MANUAL_MOMO'
  );
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [senderPhone, setSenderPhone] = useState(user?.phone || '');
  const [transactionId, setTransactionId] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [screenshotDataUrl, setScreenshotDataUrl] = useState<string>('');
  const [screenshotName, setScreenshotName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paystackStage, setPaystackStage] = useState<'IDLE' | 'INITIALIZING' | 'CHECKOUT' | 'VERIFYING'>('IDLE');
  const [paystackRef, setPaystackRef] = useState('');
  const [paystackAuthUrl, setPaystackAuthUrl] = useState('');
  const [verifiedPaystackRef, setVerifiedPaystackRef] = useState('');
  const [error, setError] = useState('');
  const [submittedTxId, setSubmittedTxId] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError('Screenshot file size must be under 4 MB.');
      return;
    }
    setScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setScreenshotDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const verifyPaystackRef = async (refToVerify: string) => {
    setPaystackStage('VERIFYING');
    setError('');
    try {
      await apiFetch<{ verified: boolean }>('/api/payments/paystack/verify', {
        method: 'POST',
        body: JSON.stringify({ reference: refToVerify }),
      });
      await refreshBootstrap();
      setVerifiedPaystackRef(refToVerify);
      setPaystackStage('IDLE');
      onSuccess();
    } catch (err: any) {
      setPaystackStage('CHECKOUT');
      setError(err?.message || 'Unable to verify Paystack transaction yet.');
    }
  };

  const handlePaystackCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPaystackStage('INITIALIZING');
    try {
      const init = await apiFetch<{
        accessCode: string;
        authorizationUrl: string;
        reference: string;
      }>('/api/payments/paystack/initialize', {
        method: 'POST',
        body: JSON.stringify({
          courseId: course.id,
          fullName,
          phone: senderPhone,
        }),
      });
      setPaystackRef(init.reference);
      setPaystackAuthUrl(init.authorizationUrl);
      setPaystackStage('CHECKOUT');

      const popup = new PaystackPop();
      popup.resumeTransaction(init.accessCode, {
        onSuccess: (tx) => {
          verifyPaystackRef(tx?.reference || init.reference);
        },
        onCancel: () => {
          setPaystackStage('IDLE');
          setError('Paystack checkout was closed. If you already completed payment, click Verify Completed Payment below.');
        },
        onError: (popupErr) => {
          setPaystackStage('IDLE');
          setError(
            popupErr?.message ||
              'Unable to open Paystack inline overlay here. You can open Paystack Checkout in a new tab using the button below.'
          );
        },
      });
    } catch (err: any) {
      setPaystackStage('IDLE');
      setError(err?.message || 'Unable to start Paystack payment.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await apiFetch<{ payment: { transactionId: string } }>('/api/payments/submit', {
        method: 'POST',
        body: JSON.stringify({
          fullName,
          email,
          courseId: course.id,
          amountGhs: course.priceGhs,
          senderPhone,
          transactionId,
          paymentDate,
          screenshotDataUrl: screenshotDataUrl || undefined,
        }),
      });
      setSubmittedTxId(res.payment.transactionId);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Unable to submit payment details.');
    } finally {
      setSubmitting(false);
    }
  };

  const unlockedCourse = bootstrap?.courses.find((c) => c.id === course.id) || course;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Course Payment Checkout"
    >
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Course Enrolment Payment
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {course.title} · GH₵ {course.priceGhs.toFixed(2)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment modal"
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {verifiedPaystackRef ? (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5 text-sm">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                    Paystack Payment Verified — Full Course Unlocked!
                  </p>
                  <p className="text-emerald-800 dark:text-emerald-300">
                    Reference <span className="font-mono font-semibold">{verifiedPaystackRef}</span> has been confirmed.
                    Your enrolment, locked lessons, and Google Drive tutorial links are now active for{' '}
                    <span className="font-mono">{email}</span>.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                {unlockedCourse.driveFolderId && (
                  <a
                    href={`https://drive.google.com/drive/folders/${unlockedCourse.driveFolderId}?usp=drive_link`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
                  >
                    <span>Open Google Drive Videos</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl transition-colors cursor-pointer"
                >
                  Continue to Course
                </button>
              </div>
            </div>
          ) : submittedTxId ? (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-emerald-900 dark:text-emerald-200">
                    Payment Details Submitted (Status: PENDING)
                  </p>
                  <p className="text-emerald-800 dark:text-emerald-300">
                    Your Transaction ID <span className="font-mono font-semibold">{submittedTxId}</span> has been
                    received. An administrator will verify your MTN Mobile Money transfer and activate your course access.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl transition-colors cursor-pointer"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          ) : (
            <>
              {paystackAllowed && manualAllowed && (
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setMethod('PAYSTACK');
                      setError('');
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      method === 'PAYSTACK'
                        ? 'bg-white dark:bg-slate-900 text-[#EA580C] dark:text-orange-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 shrink-0" />
                    <span>Paystack Instant (MoMo / Card)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMethod('MANUAL_MOMO');
                      setError('');
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      method === 'MANUAL_MOMO'
                        ? 'bg-white dark:bg-slate-900 text-[#EA580C] dark:text-orange-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 shrink-0" />
                    <span>Manual MTN MoMo Transfer</span>
                  </button>
                </div>
              )}

              {method === 'PAYSTACK' && paystackAllowed ? (
                <form onSubmit={handlePaystackCheckout} className="space-y-4">
                  <div className="rounded-2xl bg-[#111827] text-white p-5 space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-orange-300 text-xs font-semibold uppercase tracking-wider">
                        <CreditCard className="w-4 h-4" />
                        <span>Instant Automated Payment via Paystack</span>
                      </div>
                      <span className="text-lg font-bold font-mono tabular-nums text-orange-300">
                        GH₵ {course.priceGhs.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Pay securely with <strong>MTN Mobile Money, Telecel Cash, AT Money, Visa, or Mastercard</strong>.
                      As soon as Paystack confirms payment, your course lessons and Google Drive video folder unlock
                      automatically.
                    </p>
                  </div>

                  {!paystackConfigured && (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                      <p className="font-semibold">
                        Paystack server secret key (PAYSTACK_SECRET_KEY) is not configured yet.
                      </p>
                      <p>
                        Site Owner: add <span className="font-mono font-semibold">PAYSTACK_SECRET_KEY</span> to your
                        server environment secrets to activate live Paystack checkout.
                      </p>
                      {manualAllowed && (
                        <button
                          type="button"
                          onClick={() => {
                            setMethod('MANUAL_MOMO');
                            setError('');
                          }}
                          className="font-semibold text-[#EA580C] dark:text-orange-400 hover:underline cursor-pointer"
                        >
                          Switch to Manual MTN MoMo Transfer ({settings?.momoNumber || '0257460536'}) →
                        </button>
                      )}
                    </div>
                  )}

                  {error && (
                    <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Student Full Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Sign-Up Email (Google Drive Access) *
                      </label>
                      <input
                        type="email"
                        required
                        readOnly={Boolean(user?.email)}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Phone Number (for MoMo prompt / receipt)
                      </label>
                      <input
                        type="tel"
                        placeholder="e.g. 0551234567"
                        value={senderPhone}
                        onChange={(e) => setSenderPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                  </div>

                  {paystackRef && (
                    <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span>
                          Active Paystack Ref: <strong className="font-mono">{paystackRef}</strong>
                        </span>
                        <button
                          type="button"
                          disabled={paystackStage === 'VERIFYING'}
                          onClick={() => verifyPaystackRef(paystackRef)}
                          className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          {paystackStage === 'VERIFYING' ? 'Verifying...' : 'Verify Completed Payment →'}
                        </button>
                      </div>
                      {paystackAuthUrl && (
                        <a
                          href={paystackAuthUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#EA580C] dark:text-orange-400 font-semibold hover:underline"
                        >
                          <span>Or open Paystack Checkout in a new tab</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <ShieldCheck className="w-4 h-4 text-[#EA580C] dark:text-orange-400 shrink-0" />
                      <span>Verified server-side with Paystack before unlocking access.</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!paystackConfigured || paystackStage === 'INITIALIZING' || paystackStage === 'VERIFYING'}
                        className="px-5 py-2.5 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                      >
                        {paystackStage === 'INITIALIZING'
                          ? 'Connecting to Paystack...'
                          : paystackStage === 'VERIFYING'
                            ? 'Verifying Payment...'
                            : `Pay GH₵ ${course.priceGhs.toFixed(2)} Now`}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <>
                  {/* Clear Payment Instructions Box */}
                  <div className="rounded-2xl bg-[#111827] text-white p-5 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 text-orange-300 text-xs font-semibold uppercase tracking-wider">
                        <Smartphone className="w-4 h-4" />
                        <span>Step 1: Send Mobile Money Transfer</span>
                      </div>
                      <span className="text-lg font-bold font-mono tabular-nums text-orange-300">
                        GH₵ {course.priceGhs.toFixed(2)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-700/70 text-sm">
                      <div>
                        <div className="text-slate-400 text-xs">Send payment to</div>
                        <div className="font-bold text-base mt-0.5">
                          {settings?.momoBusinessName || 'EK TECH SOLUTIONS'}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-xs">MTN Mobile Money Number</div>
                        <div className="font-bold font-mono tabular-nums text-base text-orange-300 mt-0.5">
                          {settings?.momoNumber || '0257460536'}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Use your registered name or course title as reference. After receiving your MTN SMS confirmation,
                      enter the Transaction ID below. Payments are manually verified by an administrator before access is
                      unlocked.
                    </p>
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Student Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Sign-Up Email (Used for Google Drive Video Access) *
                    </label>
                    <input
                      type="email"
                      required
                      readOnly={Boolean(user?.email)}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 ${
                        user?.email
                          ? 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-mono'
                          : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
                      } focus:outline-none focus:ring-2 focus:ring-orange-500`}
                    />
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Course Google Drive videos will be unlocked on this email once payment is verified.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Course Selected
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={course.title}
                      className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Course Amount (GH₵)
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`GH₵ ${course.priceGhs.toFixed(2)}`}
                      className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      MoMo Sender&apos;s Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 0551234567"
                      value={senderPhone}
                      onChange={(e) => setSenderPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Payment Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    MTN Mobile Money Transaction ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MP261116.1045.B90412"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Optional Payment Screenshot (PNG / JPG)
                  </label>
                  <label className="flex items-center justify-between px-4 py-3 rounded-xl border border-dashed border-[#EFE7DF] dark:border-slate-700 hover:border-[#EA580C] cursor-pointer text-sm text-[#4B5563] dark:text-slate-300">
                    <span className="flex items-center gap-2 truncate">
                      <Upload className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{screenshotName || 'Attach MTN MoMo receipt screenshot (optional)'}</span>
                    </span>
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    <span className="text-xs font-medium text-[#EA580C] dark:text-orange-400 shrink-0">Browse</span>
                  </label>
                </div>

                <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <ShieldCheck className="w-4 h-4 text-[#EA580C] dark:text-orange-400 shrink-0" />
                    <span>Duplicate Transaction IDs are automatically blocked.</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-5 py-2.5 text-sm font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] disabled:opacity-60 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {submitting ? 'Submitting...' : 'Submit Payment Details'}
                    </button>
                  </div>
                </div>
              </form>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function CertificateModal({
  certificate,
  onClose,
}: {
  certificate: Certificate;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Certificate Preview"
    >
      <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#111827] dark:text-white">
            <Award className="w-4 h-4 text-[#EA580C] dark:text-orange-400" />
            <span>Official Academy Certificate</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#D44E07] rounded-xl cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close certificate"
              className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-8 bg-[#FFFBF7] dark:bg-slate-950">
          <div className="bg-white text-[#111827] p-10 rounded-2xl border-2 border-[#111827] relative">
            <div className="border border-[#EFE7DF] p-8 space-y-8 text-center">
              <div className="space-y-1">
                <div className="text-xs font-semibold tracking-widest uppercase text-[#EA580C]">
                  EK TECH SOLUTIONS ONLINE ACADEMY
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight text-[#111827]">
                  Certificate of Completion
                </h2>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-slate-500">This certifies that</p>
                <div className="text-2xl font-bold text-[#111827]">{certificate.studentName}</div>
                <p className="text-sm text-slate-500">has successfully completed all coursework and assessments for</p>
                <div className="text-xl font-semibold text-[#EA580C]">{certificate.courseTitle}</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-slate-200 text-xs text-slate-600">
                <div>
                  <div className="font-semibold text-slate-900">{certificate.instructorName}</div>
                  <div>Lead Course Instructor</div>
                </div>
                <div>
                  <div className="font-mono font-semibold text-slate-900 tabular-nums">
                    {certificate.certificateNumber}
                  </div>
                  <div>Credential Verification ID</div>
                </div>
                <div>
                  <div className="font-semibold text-slate-900 tabular-nums">
                    {new Date(certificate.issuedAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </div>
                  <div>Date Issued</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
