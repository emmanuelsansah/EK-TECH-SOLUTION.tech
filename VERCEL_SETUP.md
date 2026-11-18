# EK TECH SOLUTIONS — Vercel Deployment & Environment Configuration Guide

This guide walks you through setting up all environment variables and deploying the EK TECH SOLUTIONS Online Academy application on **Vercel**.

---

## 1. Quick Copy-Paste Environment Variables Block

In your Vercel Dashboard, navigate to:
**Project Settings → Environment Variables**

You can click **"Paste .env"** or paste the raw key-value pairs directly:

```env
# --- Application Domain ---
APP_URL=https://your-project.vercel.app

# --- Session & Password Security (Generate 32+ character random strings) ---
SESSION_SECRET=ek_tech_super_secure_session_secret_2026_x9a8b7c6
PASSWORD_PEPPER=ek_tech_secure_password_pepper_2026_k1m2n3p4

# --- Supabase Database (Persistent Storage across Serverless Lambdas) ---
SUPABASE_URL=https://fimobcmrmdpxweaxitwq.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbW9iY21ybWRweHdlYXhpdHdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4NTIwMTIsImV4cCI6MjExMDQyODAxMn0.jFxDgZjXfqdhWAXKKQYcFZEhsLfKCnlC23XYQLcKFjU
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DATABASE_URL=postgresql://postgres:your-db-password@db.fimobcmrmdpxweaxitwq.supabase.co:5432/postgres

# --- Frontend Client Supabase (Vite) ---
VITE_SUPABASE_URL=https://fimobcmrmdpxweaxitwq.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbW9iY21ybWRweHdlYXhpdHdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ4NTIwMTIsImV4cCI6MjExMDQyODAxMn0.jFxDgZjXfqdhWAXKKQYcFZEhsLfKCnlC23XYQLcKFjU

# --- Email 2FA & Notifications (Gmail SMTP / Google App Password) ---
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=emmanuelsansah020@gmail.com
SMTP_PASS=your-16-char-google-app-password
SMTP_FROM=EK TECH SOLUTIONS Academy <emmanuelsansah020@gmail.com>

# --- Paystack Payments (Ghana GHS - Mobile Money & Card) ---
PAYSTACK_PUBLIC_KEY=pk_test_or_pk_live_your_paystack_public_key
PAYSTACK_SECRET_KEY=sk_test_or_sk_live_your_paystack_secret_key
PAYSTACK_WEBHOOK_SECRET=

# --- Optional Gemini AI Key ---
GEMINI_API_KEY=
```

---

## 2. Step-by-Step Vercel Configuration

### Step A: Open Vercel Environment Variables
1. Log in to [vercel.com](https://vercel.com).
2. Select your project: **EK TECH SOLUTIONS** (or import the repository from GitHub).
3. Go to **Settings** (top tab) → **Environment Variables** (left sidebar).

### Step B: Add the Variables
For each variable:
- Key: The variable name (e.g. `SESSION_SECRET`)
- Value: The corresponding secret or URL
- Target environments: Select **Production**, **Preview**, and **Development** (check all 3 boxes).
- Click **Save**.

*(Tip: You can click the **Import .env** link above the form to paste all variables at once.)*

---

## 3. Details on Key Variables

### A. Persistent Data on Vercel (Supabase)
Vercel serverless functions have ephemeral, read-only filesystems (only `/tmp` is temporarily writable). To ensure student registrations, payments, lesson progress, and certificates persist across lambdas and deployments:
- **`SUPABASE_URL`**: `https://fimobcmrmdpxweaxitwq.supabase.co`
- **`SUPABASE_ANON_KEY`**: Found in Supabase Dashboard → **Project Settings** → **API** → **Project API Keys** → `anon` `public`.
- **`SUPABASE_SERVICE_ROLE_KEY`**: Found in Supabase Dashboard → **Project Settings** → **API** → **Project API Keys** → `service_role` `secret`. *(Never expose this in client-side code).*
- **`DATABASE_URL`**: Found in Supabase Dashboard → **Project Settings** → **Database** → **Connection string** (URI). Replace `[YOUR-PASSWORD]` with your actual database password.

### B. Email 2FA (Gmail SMTP)
When students register or sign in, 2FA verification codes are sent via email:
1. Ensure 2-Step Verification is ON in your Google Account: [https://myaccount.google.com/security](https://myaccount.google.com/security).
2. Go to [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Create a new App Password named **"EK TECH LMS"**.
4. Copy the 16-character password (e.g. `abcd efgh ijkl mnop`).
5. Set `SMTP_PASS` to this 16-character string (without spaces).
6. Set `SMTP_USER` to your Gmail address: `emmanuelsansah020@gmail.com`.

### C. Paystack Payments (Mobile Money & Card in Ghana)
1. Go to your [Paystack Dashboard](https://dashboard.paystack.com/#/settings/developers) → **Settings** → **API Keys & Webhooks**.
2. Copy your **Public Key** (`pk_live_...` or `pk_test_...`) into `PAYSTACK_PUBLIC_KEY`.
3. Copy your **Secret Key** (`sk_live_...` or `sk_test_...`) into `PAYSTACK_SECRET_KEY`.
4. In Paystack Settings under **Live Webhook URL** (or Test Webhook URL), enter:
   `https://your-project.vercel.app/api/payments/paystack/webhook`

### D. Production App URL
- Set `APP_URL` to your production Vercel domain, e.g.:
  `https://your-project.vercel.app` (or your custom domain `https://ektechacademy.com`).

---

## 4. Vercel Build Settings Verification

In **Settings → General**:
- **Framework Preset**: `Vite` (or `Other`)
- **Root Directory**: `./` (leave empty or default)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install` (or `bun install`)
- **Node.js Version**: `20.x` (recommended)

---

## 5. Important: Redeploy After Adding Variables

Environment variables in Vercel do **not** take effect on active deployments retroactively.
After adding or editing your environment variables:
1. Go to the **Deployments** tab in Vercel.
2. Click the three dots `...` next to the latest deployment.
3. Select **Redeploy** (ensure "Use existing Build Cache" is unchecked if you updated `VITE_*` variables).
4. Wait ~60 seconds for the build to finish.
5. Visit `https://your-project.vercel.app/api/health` to confirm the health check returns:
   ```json
   {
     "ok": true,
     "smtpConfigured": true,
     "paystackConfigured": true,
     "supabaseConfigured": true
   }
   ```
