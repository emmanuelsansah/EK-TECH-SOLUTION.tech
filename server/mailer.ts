import nodemailer from 'nodemailer';
import type { EmailPreviewPayload } from '../src/types.ts';

export type TwoFactorPurpose = 'LOGIN' | 'REGISTER' | 'PASSWORD_RESET';

export function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function purposeCopy(purpose: TwoFactorPurpose) {
  if (purpose === 'REGISTER') {
    return {
      subject: 'Verify Your EK TECH SOLUTIONS Account (2FA Code)',
      heading: 'Confirm Your Student Registration',
      intro:
        'Thank you for registering with EK TECH SOLUTIONS Online Academy. Enter the 6-digit verification code below to verify your email address and activate 2FA protection on your account.',
    };
  }
  if (purpose === 'PASSWORD_RESET') {
    return {
      subject: 'EK TECH SOLUTIONS Password Reset 2FA Code',
      heading: 'Verify Password Reset Request',
      intro:
        'We received a request to reset your EK TECH SOLUTIONS account password. Enter this 6-digit verification code to confirm your identity and set a new strong password.',
    };
  }
  return {
    subject: 'EK TECH SOLUTIONS Sign-In 2FA Verification Code',
    heading: 'Two-Factor Sign-In Verification',
    intro:
      'A sign-in attempt was verified with your password. Enter this 6-digit 2FA verification code to complete your login.',
  };
}

export async function sendTwoFactorEmail(params: {
  to: string;
  recipientName?: string;
  code: string;
  purpose: TwoFactorPurpose;
  expiresInMinutes: number;
  ipAddress?: string;
}): Promise<{ deliveryMode: 'SMTP' | 'PREVIEW_OUTBOX'; preview?: EmailPreviewPayload }> {
  const copy = purposeCopy(params.purpose);
  const greetingName = params.recipientName ? `Hello ${params.recipientName},` : 'Hello,';

  const textBody = [
    `EK TECH SOLUTIONS ONLINE ACADEMY — SECURITY VERIFICATION`,
    ``,
    greetingName,
    ``,
    copy.intro,
    ``,
    `Your 6-digit 2FA Verification Code: ${params.code}`,
    `Expires in: ${params.expiresInMinutes} minutes`,
    params.ipAddress ? `Request IP: ${params.ipAddress}` : '',
    ``,
    `If you did not initiate this request, ignore this email and change your password immediately.`,
  ]
    .filter(Boolean)
    .join('\n');

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; background: #FFF7F0; padding: 24px; border-radius: 16px; border: 1px solid #EFE7DF;">
      <div style="background: #FFFFFF; padding: 28px; border-radius: 12px; border: 1px solid #EFE7DF;">
        <div style="font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #EA580C; margin-bottom: 8px;">
          EK TECH SOLUTIONS · 2FA SECURITY
        </div>
        <h2 style="margin: 0 0 12px; font-size: 20px; color: #111827;">${copy.heading}</h2>
        <p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #4B5563;">${greetingName}</p>
        <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #4B5563;">${copy.intro}</p>
        <div style="background: #FFF7F0; border: 1px solid #FCD5BA; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 20px;">
          <div style="font-size: 11px; color: #C2410C; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px;">
            Verification Code
          </div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 32px; font-weight: 800; letter-spacing: 0.2em; color: #111827;">
            ${params.code}
          </div>
          <div style="font-size: 12px; color: #6B7280; margin-top: 6px;">
            Valid for ${params.expiresInMinutes} minutes · Do not share this code
          </div>
        </div>
        <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #6B7280;">
          If you did not request this verification, please ignore this email or sign in and revoke active sessions.
        </p>
      </div>
    </div>
  `;

  if (isSmtpConfigured()) {
    const port = Number(process.env.SMTP_PORT || 465);
    const secure =
      process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : port === 465;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `"EK TECH SOLUTIONS Academy" <${process.env.SMTP_USER}>`,
      to: params.to,
      subject: copy.subject,
      text: textBody,
      html: htmlBody,
    });

    return { deliveryMode: 'SMTP' };
  }

  // Transparent Preview Outbox when SMTP env credentials are not yet set in runtime secrets
  console.info(
    `[2FA Email Preview -> ${params.to}] (${params.purpose}) Code: ${params.code} (expires in ${params.expiresInMinutes}m)`
  );

  return {
    deliveryMode: 'PREVIEW_OUTBOX',
    preview: {
      to: params.to,
      subject: copy.subject,
      code: params.code,
      purpose: params.purpose,
      expiresInMinutes: params.expiresInMinutes,
      deliveryMode: 'PREVIEW_OUTBOX',
    },
  };
}
