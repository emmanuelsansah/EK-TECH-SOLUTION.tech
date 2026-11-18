const fs = require('fs');
const path = require('path');
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  WidthType,
  ShadingType,
  Header,
  Footer,
  PageNumber,
  UnderlineType,
} = require('docx');

async function generateReport() {
  const downloadsDir = path.resolve(__dirname, '..', 'public', 'downloads');
  if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir, { recursive: true });
  }

  const primaryOrange = 'EA580C';
  const darkNavy = '111827';
  const slateGray = '4B5563';
  const lightBg = 'F9FAFB';
  const borderGray = 'D1D5DB';

  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: borderGray },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: borderGray },
    left: { style: BorderStyle.SINGLE, size: 1, color: borderGray },
    right: { style: BorderStyle.SINGLE, size: 1, color: borderGray },
  };

  function createHeaderCell(text, widthPercent) {
    return new TableCell({
      width: { size: widthPercent, type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: primaryOrange },
      margins: { top: 120, bottom: 120, left: 140, right: 140 },
      borders: cellBorder,
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text,
              bold: true,
              color: 'FFFFFF',
              size: 20,
              font: 'Calibri',
            }),
          ],
        }),
      ],
    });
  }

  function createDataCell(text, widthPercent, isCode = false, isBold = false) {
    return new TableCell({
      width: { size: widthPercent, type: WidthType.PERCENTAGE },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      borders: cellBorder,
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold: isBold,
              size: 19,
              font: isCode ? 'Consolas' : 'Calibri',
              color: isCode ? primaryOrange : darkNavy,
            }),
          ],
        }),
      ],
    });
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'EK TECH SOLUTIONS — Comprehensive Technical & Architecture Report',
                    size: 16,
                    color: slateGray,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Page ',
                    size: 16,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 16,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    font: 'Calibri',
                  }),
                  new TextRun({
                    text: '  |  Confidential & Proprietary  |  EK TECH SOLUTIONS',
                    size: 16,
                    color: slateGray,
                    font: 'Calibri',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // TITLE / COVER HEADER
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 100 },
            children: [
              new TextRun({
                text: 'EK TECH SOLUTIONS',
                bold: true,
                size: 48,
                color: primaryOrange,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Online Technology & AI Academy — Technical System & Architecture Report',
                bold: true,
                size: 28,
                color: darkNavy,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: 'Version 2.4  |  Compiled Date: November 2026  |  Lead Developer: Emmanuel Sansah (emmanuelsansah020@gmail.com)',
                italics: true,
                size: 18,
                color: slateGray,
                font: 'Calibri',
              }),
            ],
          }),

          // SECTION 1: EXECUTIVE SUMMARY
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 120 },
            children: [
              new TextRun({
                text: '1. Executive Summary & Mission',
                bold: true,
                size: 28,
                color: primaryOrange,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: 'EK TECH SOLUTIONS is a modern, full-stack, enterprise-grade Online Academy and Learning Management System (LMS) specifically architected for digital skills training, Artificial Intelligence education, web engineering, prompt engineering, and multimedia creation.',
                size: 21,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: 'The platform integrates automated Ghana payment systems (MTN Mobile Money, Telecel Cash, AT Money, and Cards via Paystack), email-delivered Two-Factor Authentication (2FA), Google Drive cloud learning repositories, dynamic PDF study guide generation, cryptographically chained security audit logs, and instant fallback hydration for zero-downtime serverless deployments on Vercel.',
                size: 21,
                font: 'Calibri',
              }),
            ],
          }),

          // SECTION 2: PROGRAMMING LANGUAGES
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 300, after: 120 },
            children: [
              new TextRun({
                text: '2. Programming Languages Used to Build This Site',
                bold: true,
                size: 28,
                color: primaryOrange,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: 'The entire application has been built from the ground up using industry-standard, high-performance programming languages. Each language has a dedicated, specialized role in the architecture:',
                size: 21,
                font: 'Calibri',
              }),
            ],
          }),

          // Table of languages
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Language', 22),
                  createHeaderCell('Usage & Domain', 28),
                  createHeaderCell('Key Files & Implementations', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('TypeScript (v5.x / 7.x)', 22, false, true),
                  createDataCell('Full-Stack Strongly Typed Core (Frontend & Backend)', 28),
                  createDataCell('src/App.tsx, server.ts, src/types.ts, server/auth.ts, server/store.ts, server/security.ts. Provides compile-time safety, strict interfaces, and zero-runtime type errors.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('JavaScript (ES2024 / Node.js)', 22, false, true),
                  createDataCell('Vite Build Toolchain & Serverless Runtime', 28),
                  createDataCell('vite.config.ts, api/[...route].ts, Vercel Serverless Function engine, dynamic ES module imports, Paystack Inline JS integration.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('SQL (PostgreSQL 15+)', 22, false, true),
                  createDataCell('Relational Database Schema & Data Integrity', 28),
                  createDataCell('supabase/schema.sql, supabase/seed.sql. Defines users, courses, enrolments, payments, certificates, foreign keys, constraints, and audit logging tables.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('HTML5', 22, false, true),
                  createDataCell('Semantic Web & Accessible UI Structure', 28),
                  createDataCell('index.html, semantic page elements (<header>, <nav>, <main>, <article>, <section>), OpenGraph metadata, mobile viewport meta tags.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('CSS3 & Tailwind CSS (v4)', 22, false, true),
                  createDataCell('Design System, Responsive Layout & Theming', 28),
                  createDataCell('src/index.css, @tailwindcss/vite. Responsive flexbox, CSS grid, dark/light theme tokens, typography scale, custom scrollbars, and card micro-interactions.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('JSON / JSON-LD', 22, false, true),
                  createDataCell('Data Persistence & Structured Configuration', 28),
                  createDataCell('data/lms-db.json, metadata.json, vercel.json, package.json. Schema blueprints, offline JSON storage engine, and Vercel routing rules.', 50),
                ],
              }),
            ],
          }),

          // SECTION 3: FRAMEWORKS & LIBRARIES
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 360, after: 120 },
            children: [
              new TextRun({
                text: '3. Frameworks, Libraries & Technology Stack',
                bold: true,
                size: 28,
                color: primaryOrange,
                font: 'Calibri',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Technology / Layer', 25),
                  createHeaderCell('Package & Version', 25),
                  createHeaderCell('Functional Purpose', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Frontend Framework', 25, false, true),
                  createDataCell('React 19 (v19.0.1)', 25, true),
                  createDataCell('Component architecture, declarative UI state, custom hooks (useApp), context state synchronization, and reactive dashboards.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Styling Engine', 25, false, true),
                  createDataCell('Tailwind CSS v4 + @tailwindcss/vite', 25, true),
                  createDataCell('Zero-runtime utility-first CSS styling engine with built-in dark mode and mobile-responsive breakpoints.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Icons & UI Assets', 25, false, true),
                  createDataCell('Lucide React (v0.546)', 25, true),
                  createDataCell('High-clarity SVG iconography across course cards, student dashboards, security monitors, and admin menus.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Build Bundler', 25, false, true),
                  createDataCell('Vite 8 (v8.3.0)', 25, true),
                  createDataCell('Next-generation frontend bundler producing optimized production JS/CSS assets in dist/ with asset copying hooks.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Backend Server', 25, false, true),
                  createDataCell('Express.js (v4.21.2) + Node.js 20', 25, true),
                  createDataCell('High-throughput REST API serving /api endpoints, security headers, rate limiters, session cookies, and webhook listeners.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Database & Cloud', 25, false, true),
                  createDataCell('Supabase PostgreSQL (@supabase/supabase-js v2.119)', 25, true),
                  createDataCell('Relational PostgreSQL database for persistent cross-lambda storage, direct SQL connection pooling (pg.Pool), and REST API.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Payment Gateway', 25, false, true),
                  createDataCell('Paystack (@paystack/inline-js v2.28)', 25, true),
                  createDataCell('Ghana Cedis (GHS) payment gateway supporting MTN MoMo, Telecel Cash, AT Money, and Visa/Mastercard with SHA-512 webhook security.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Email Delivery (2FA)', 25, false, true),
                  createDataCell('Nodemailer (v10.6.0)', 25, true),
                  createDataCell('SMTP mail client connected via SSL Port 465 to send real-time 6-digit 2FA login and registration codes.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('Security & Crypto', 25, false, true),
                  createDataCell('Node.js Native Crypto', 25, true),
                  createDataCell('HMAC-SHA256 OTP hashing, HMAC-SHA512 webhook signatures, PBKDF2/scrypt password hashing with pepper and salts.', 50),
                ],
              }),
            ],
          }),

          // SECTION 4: SYSTEM MODULES
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 360, after: 120 },
            children: [
              new TextRun({
                text: '4. Core System Modules & Features',
                bold: true,
                size: 28,
                color: primaryOrange,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: '• Authentication & Email 2FA: ',
                bold: true,
                size: 21,
                color: darkNavy,
                font: 'Calibri',
              }),
              new TextRun({
                text: 'Multi-role user authentication (Student, Instructor, Super Admin) with mandatory 6-digit email OTP challenges. Includes rate-limiting (max 5 failed attempts per 15 mins) and automatic session revocation.',
                size: 20,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: '• Course Catalog & Video Learning Room: ',
                bold: true,
                size: 21,
                color: darkNavy,
                font: 'Calibri',
              }),
              new TextRun({
                text: '8 career courses with structured modules, lessons, free preview access for Lesson 1, locked premium video access, lesson progress tracking, and downloadable study summaries.',
                size: 20,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: '• Automated Paystack Mobile Money Integration: ',
                bold: true,
                size: 21,
                color: darkNavy,
                font: 'Calibri',
              }),
              new TextRun({
                text: 'Full support for Ghana Cedis (GH₵ 50 enrolment). Supports inline popups, mobile money prompts on Ghanaian telecom networks, and automated server-side webhook verification using HMAC-SHA512 signatures.',
                size: 20,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: '• Google Drive Material Unlocking: ',
                bold: true,
                size: 21,
                color: darkNavy,
                font: 'Calibri',
              }),
              new TextRun({
                text: 'Enrolled students receive instant, secure access to embedded Google Drive folders containing raw video files, templates, source code, and design assets.',
                size: 20,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: '• Certificate Issuance Engine: ',
                bold: true,
                size: 21,
                color: darkNavy,
                font: 'Calibri',
              }),
              new TextRun({
                text: 'When a learner completes 100% of a course lessons, the system automatically generates a unique serial-numbered Certificate of Completion (e.g. EKTS-2026-00414) with printable layout and verifiable credential ID.',
                size: 20,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: '• CIA Triad Security & Tamper-Proof Audit Chain: ',
                bold: true,
                size: 21,
                color: darkNavy,
                font: 'Calibri',
              }),
              new TextRun({
                text: 'Real-time security monitor tracking Confidentiality, Integrity, and Availability. Every administrative or financial action is logged into a cryptographically hashed blockchain-style audit ledger where each entry contains a SHA-256 seal of the previous log.',
                size: 20,
                font: 'Calibri',
              }),
            ],
          }),

          // SECTION 5: VERCEL DEPLOYMENT & ENVIRONMENT
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 360, after: 120 },
            children: [
              new TextRun({
                text: '5. Production Deployment on Vercel',
                bold: true,
                size: 28,
                color: primaryOrange,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: 'The application is deployed on Vercel as a hybrid modern web application (Static SPA + Serverless Node.js Functions). The Vercel architecture operates as follows:',
                size: 21,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: '1. Frontend Hosting: ',
                bold: true,
                size: 20,
                font: 'Calibri',
              }),
              new TextRun({
                text: 'Compiled HTML, JS, CSS, and static images are distributed across Vercel’s global Edge CDN via dist/ and public/assets/.',
                size: 20,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: '2. Serverless API Routing: ',
                bold: true,
                size: 20,
                font: 'Calibri',
              }),
              new TextRun({
                text: 'All requests to /api/* are intercepted by api/[...route].ts and processed by the Express backend with path normalization.',
                size: 20,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: '3. Data Persistence across Cold Starts: ',
                bold: true,
                size: 20,
                font: 'Calibri',
              }),
              new TextRun({
                text: 'The backend uses Supabase PostgreSQL for permanent storage. Even if serverless containers shut down, data is automatically hydrated upon the next invocation.',
                size: 20,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: '4. Instant Fallback Bootstrap: ',
                bold: true,
                size: 20,
                font: 'Calibri',
              }),
              new TextRun({
                text: 'The frontend mounts with DEFAULT_FALLBACK_BOOTSTRAP, guaranteeing that slow cold starts or database network latency never cause blank screens or broken tabs.',
                size: 20,
                font: 'Calibri',
              }),
            ],
          }),

          // SECTION 6: ENVIRONMENT VARIABLES REFERENCE
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 360, after: 120 },
            children: [
              new TextRun({
                text: '6. Master Environment Variables Reference',
                bold: true,
                size: 28,
                color: primaryOrange,
                font: 'Calibri',
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  createHeaderCell('Variable', 30),
                  createHeaderCell('Target / Scope', 20),
                  createHeaderCell('Description & Example', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('APP_URL', 30, true),
                  createDataCell('Server', 20),
                  createDataCell('Production domain (e.g. https://your-project.vercel.app) used for webhook and redirect validation.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('SESSION_SECRET', 30, true),
                  createDataCell('Server', 20),
                  createDataCell('High-entropy random key used for cryptographic cookie & session token signing.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('PASSWORD_PEPPER', 30, true),
                  createDataCell('Server', 20),
                  createDataCell('Secondary server secret combined with individual user salts for password hashing.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('SUPABASE_URL', 30, true),
                  createDataCell('Server', 20),
                  createDataCell('https://fimobcmrmdpxweaxitwq.supabase.co', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('SUPABASE_SERVICE_ROLE_KEY', 30, true),
                  createDataCell('Server (Secret)', 20),
                  createDataCell('Supabase administrative service key for cross-lambda persistent writes bypassing RLS.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('DATABASE_URL', 30, true),
                  createDataCell('Server (Secret)', 20),
                  createDataCell('PostgreSQL direct connection string URI: postgresql://postgres:[PASSWORD]@db.fimobcmrmdpxweaxitwq.supabase.co:5432/postgres', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('VITE_SUPABASE_URL', 30, true),
                  createDataCell('Frontend (Public)', 20),
                  createDataCell('Client-side Supabase URL exposed to browser build.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('VITE_SUPABASE_ANON_KEY', 30, true),
                  createDataCell('Frontend (Public)', 20),
                  createDataCell('Public anon JWT key for browser real-time subscriptions.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('SMTP_HOST & SMTP_PORT', 30, true),
                  createDataCell('Server', 20),
                  createDataCell('smtp.gmail.com on Port 465 (SMTP_SECURE=true).', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('SMTP_USER & SMTP_PASS', 30, true),
                  createDataCell('Server (Secret)', 20),
                  createDataCell('emmanuelsansah020@gmail.com with 16-character Google App Password.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('PAYSTACK_PUBLIC_KEY', 30, true),
                  createDataCell('Server & Frontend', 20),
                  createDataCell('pk_live_... or pk_test_... used to initialize Paystack popups.', 50),
                ],
              }),
              new TableRow({
                children: [
                  createDataCell('PAYSTACK_SECRET_KEY', 30, true),
                  createDataCell('Server (Secret)', 20),
                  createDataCell('sk_live_... or sk_test_... used for HMAC webhook verification and charge verification.', 50),
                ],
              }),
            ],
          }),

          // SECTION 7: SUMMARY & CONCLUSION
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 360, after: 120 },
            children: [
              new TextRun({
                text: '7. Summary & Verification Status',
                bold: true,
                size: 28,
                color: primaryOrange,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: 'The EK TECH SOLUTIONS application is fully compiled, type-checked, security-audited, and production-ready for global deployment on Vercel. All assets, images, databases, and APIs have been configured with resilient fallbacks, ensuring optimal performance for learners in Ghana and worldwide.',
                size: 21,
                font: 'Calibri',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 300 },
            children: [
              new TextRun({
                text: '— End of Technical Report —',
                bold: true,
                italics: true,
                size: 18,
                color: slateGray,
                font: 'Calibri',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const docxBuffer = await Packer.toBuffer(doc);
  const docxFilePath = path.join(downloadsDir, 'EK_TECH_SOLUTIONS_Architecture_Report.docx');
  fs.writeFileSync(docxFilePath, docxBuffer);
  console.log('Successfully generated .docx at:', docxFilePath);

  // Also create a rich HTML-based .doc file that opens in any version of MS Word, LibreOffice, or Google Docs
  const htmlDocContent = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>EK TECH SOLUTIONS — System Architecture Report</title>
  <style>
    body { font-family: Calibri, 'Segoe UI', Arial, sans-serif; margin: 40px; color: #111827; line-height: 1.6; }
    h1 { color: #EA580C; border-bottom: 2px solid #EA580C; padding-bottom: 6px; font-size: 24pt; }
    h2 { color: #111827; margin-top: 24px; font-size: 16pt; border-bottom: 1px solid #E5E7EB; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 18px 0; }
    th { background-color: #EA580C; color: #ffffff; text-align: left; padding: 10px; font-weight: bold; border: 1px solid #D1D5DB; }
    td { padding: 9px; border: 1px solid #D1D5DB; vertical-align: top; font-size: 10.5pt; }
    tr:nth-child(even) { background-color: #F9FAFB; }
    .badge { background-color: #FFF0E5; color: #EA580C; font-weight: bold; padding: 2px 6px; border-radius: 4px; font-family: Consolas, monospace; }
    .footer { margin-top: 40px; font-size: 9pt; color: #6B7280; text-align: center; border-top: 1px solid #E5E7EB; padding-top: 12px; }
  </style>
</head>
<body>
  <div style="text-align: center; margin-bottom: 30px;">
    <h1 style="border: none; margin-bottom: 4px;">EK TECH SOLUTIONS</h1>
    <h3 style="margin-top: 0; color: #4B5563;">Online Technology & AI Academy — Technical System & Architecture Report</h3>
    <p style="font-size: 10pt; color: #6B7280;">Author: Emmanuel Sansah (emmanuelsansah020@gmail.com) | Version 2.4 | November 2026</p>
  </div>

  <h2>1. Executive Summary</h2>
  <p>EK TECH SOLUTIONS is a modern, full-stack, enterprise-grade Online Academy and Learning Management System (LMS) specifically architected for digital skills training, Artificial Intelligence education, web engineering, prompt engineering, and multimedia creation. The platform integrates automated Ghana payment systems (MTN Mobile Money, Telecel Cash, AT Money, and Cards via Paystack), email-delivered Two-Factor Authentication (2FA), Google Drive cloud learning repositories, dynamic PDF study guide generation, cryptographically chained security audit logs, and instant fallback hydration for zero-downtime serverless deployments on Vercel.</p>

  <h2>2. Programming Languages Used to Build This Site</h2>
  <table>
    <tr><th>Language</th><th>Usage & Domain</th><th>Key Files & Implementation</th></tr>
    <tr><td><b>TypeScript (v5.x / 7.x)</b></td><td>Full-Stack Strongly Typed Core (Frontend & Backend)</td><td><code>src/App.tsx</code>, <code>server.ts</code>, <code>src/types.ts</code>, <code>server/auth.ts</code>, <code>server/store.ts</code>, <code>server/security.ts</code>. Eliminates runtime type errors, enforces contracts.</td></tr>
    <tr><td><b>JavaScript (ES2024 / Node.js)</b></td><td>Vite Build Toolchain & Serverless Runtime</td><td><code>vite.config.ts</code>, <code>api/[...route].ts</code>, Vercel Serverless Function engine, dynamic ES module imports.</td></tr>
    <tr><td><b>SQL (PostgreSQL 15+)</b></td><td>Relational Database Schema & Data Integrity</td><td><code>supabase/schema.sql</code>, <code>supabase/seed.sql</code>. Users, courses, enrolments, payments, certificates, foreign keys, constraints.</td></tr>
    <tr><td><b>HTML5</b></td><td>Semantic Web & Accessible UI Structure</td><td><code>index.html</code>, semantic page elements (&lt;header&gt;, &lt;nav&gt;, &lt;main&gt;, &lt;article&gt;), OpenGraph metadata tags.</td></tr>
    <tr><td><b>CSS3 & Tailwind CSS (v4)</b></td><td>Design System, Responsive Layout & Theming</td><td><code>src/index.css</code>, modern CSS layer syntax, responsive flexbox/grid, dark & light theme modes.</td></tr>
    <tr><td><b>JSON / JSON-LD</b></td><td>Data Persistence & Structured Configuration</td><td><code>data/lms-db.json</code>, <code>metadata.json</code>, <code>vercel.json</code>, <code>package.json</code>.</td></tr>
  </table>

  <h2>3. Frameworks, Libraries & Technology Stack</h2>
  <table>
    <tr><th>Technology</th><th>Version / Package</th><th>Role in System</th></tr>
    <tr><td><b>React 19</b></td><td>v19.0.1</td><td>Component architecture, reactive dashboard, context state management</td></tr>
    <tr><td><b>Tailwind CSS v4</b></td><td>v4.3.3</td><td>Utility-first CSS styling, responsive layout, dark mode tokens</td></tr>
    <tr><td><b>Vite 8</b></td><td>v8.3.0</td><td>High-speed development server and production build bundler</td></tr>
    <tr><td><b>Express.js</b></td><td>v4.21.2</td><td>Server REST API router, security middleware, rate limiters, session cookies</td></tr>
    <tr><td><b>Supabase PostgreSQL</b></td><td>v2.119.0</td><td>Relational persistent database across serverless function instances</td></tr>
    <tr><td><b>Paystack Gateway</b></td><td>v2.28.2</td><td>Ghana GHS payment integration for MTN, Telecel, AT Mobile Money and Card</td></tr>
    <tr><td><b>Nodemailer</b></td><td>v10.6.0</td><td>SMTP email client sending real-time 6-digit 2FA login verification codes</td></tr>
    <tr><td><b>Node.js Crypto</b></td><td>Native</td><td>HMAC-SHA256 OTP hashing, HMAC-SHA512 Paystack webhook signatures, database integrity seals</td></tr>
  </table>

  <h2>4. Core Modules & Production Architecture</h2>
  <ul>
    <li><b>Authentication & 2FA:</b> Email 2FA challenges with 6-digit cryptographic OTPs and automated account lockouts.</li>
    <li><b>Course Catalog & Video LMS:</b> 8 career tracks with structured lessons, free preview access, and locked premium content.</li>
    <li><b>Automated Paystack Payment:</b> Seamless Mobile Money transactions with automatic webhook approval and receipt issuance.</li>
    <li><b>Google Drive Material Library:</b> Instant Google Drive cloud resource unlocking upon payment verification.</li>
    <li><b>Certificate Generator:</b> Automated serial-numbered certificates (EKTS-2026-XXXXX) upon 100% course completion.</li>
    <li><b>CIA Triad Security:</b> Tamper-proof database seal and cryptographically linked security audit logs.</li>
    <li><b>Zero-Downtime Fallback:</b> Instant default bootstrap dataset so Vercel cold starts never render blank screens.</li>
  </ul>

  <div class="footer">
    EK TECH SOLUTIONS Online Academy — Built with TypeScript, React 19, Tailwind CSS v4, Node.js, Express & PostgreSQL.
  </div>
</body>
</html>`;

  const docFilePath = path.join(downloadsDir, 'EK_TECH_SOLUTIONS_Architecture_Report.doc');
  fs.writeFileSync(docFilePath, htmlDocContent, 'utf8');
  console.log('Successfully generated .doc at:', docFilePath);
}

generateReport().catch(console.error);
