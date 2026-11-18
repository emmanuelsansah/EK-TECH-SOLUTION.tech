import crypto from 'crypto';

const PAYSTACK_API_BASE = 'https://api.paystack.co';

const PLACEHOLDER_KEYS = new Set([
  'sk_test_or_sk_live_your_paystack_secret_key',
  'pk_test_or_pk_live_your_paystack_public_key',
  'your_paystack_secret_key',
  'your_paystack_public_key',
]);

export function getPaystackSecretKey(): string {
  const key = (process.env.PAYSTACK_SECRET_KEY || '').trim();
  if (!key || PLACEHOLDER_KEYS.has(key)) return '';
  return key;
}

export function getPaystackPublicKey(): string {
  const key = (process.env.PAYSTACK_PUBLIC_KEY || '').trim();
  if (!key || PLACEHOLDER_KEYS.has(key)) return '';
  return key;
}

export function getPaystackWebhookSecret(): string {
  const explicit = (process.env.PAYSTACK_WEBHOOK_SECRET || '').trim();
  return explicit || getPaystackSecretKey();
}

export function isPaystackConfigured(): boolean {
  const sk = getPaystackSecretKey();
  return sk.startsWith('sk_');
}

export interface PaystackInitializeInput {
  email: string;
  amountGhs: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface PaystackInitializeResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export async function initializePaystackTransaction(
  input: PaystackInitializeInput
): Promise<PaystackInitializeResult> {
  const secretKey = getPaystackSecretKey();
  if (!secretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured on the server.');
  }

  const amountPesewas = Math.round(Number(input.amountGhs) * 100);
  if (!Number.isFinite(amountPesewas) || amountPesewas <= 0) {
    throw new Error('Invalid course payment amount.');
  }

  const response = await fetch(`${PAYSTACK_API_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: input.email,
      amount: amountPesewas,
      currency: 'GHS',
      reference: input.reference,
      callback_url: input.callbackUrl,
      channels: ['card', 'mobile_money', 'bank'],
      metadata: input.metadata || {},
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: {
      authorization_url?: string;
      access_code?: string;
      reference?: string;
    };
  };

  if (!response.ok || !payload.status || !payload.data?.access_code || !payload.data?.authorization_url) {
    throw new Error(payload.message || `Paystack initialization failed (HTTP ${response.status}).`);
  }

  return {
    authorizationUrl: payload.data.authorization_url,
    accessCode: payload.data.access_code,
    reference: payload.data.reference || input.reference,
  };
}

export interface PaystackVerifyResult {
  status: string;
  amountPesewas: number;
  currency: string;
  reference: string;
  channel: string;
  paidAt?: string;
  gatewayResponse?: string;
  customerEmail?: string;
  metadata?: Record<string, any>;
}

export async function verifyPaystackTransaction(reference: string): Promise<PaystackVerifyResult> {
  const secretKey = getPaystackSecretKey();
  if (!secretKey) {
    throw new Error('PAYSTACK_SECRET_KEY is not configured on the server.');
  }

  const response = await fetch(
    `${PAYSTACK_API_BASE}/transaction/verify/${encodeURIComponent(reference.trim())}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    }
  );

  const payload = (await response.json().catch(() => ({}))) as {
    status?: boolean;
    message?: string;
    data?: {
      status?: string;
      amount?: number;
      currency?: string;
      reference?: string;
      channel?: string;
      paid_at?: string;
      gateway_response?: string;
      customer?: { email?: string };
      metadata?: Record<string, any>;
    };
  };

  if (!response.ok || !payload.status || !payload.data) {
    throw new Error(payload.message || `Paystack verification failed (HTTP ${response.status}).`);
  }

  return {
    status: String(payload.data.status || 'unknown').toLowerCase(),
    amountPesewas: Number(payload.data.amount || 0),
    currency: String(payload.data.currency || '').toUpperCase(),
    reference: String(payload.data.reference || reference),
    channel: String(payload.data.channel || 'paystack'),
    paidAt: payload.data.paid_at,
    gatewayResponse: payload.data.gateway_response,
    customerEmail: payload.data.customer?.email,
    metadata: payload.data.metadata,
  };
}

export function verifyPaystackWebhookSignature(rawBody: Buffer | undefined, signatureHeader: string | undefined): boolean {
  const secret = getPaystackWebhookSecret();
  if (!secret || !rawBody || !signatureHeader) return false;
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signatureHeader.trim().toLowerCase(), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
