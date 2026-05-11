import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PublicKey } from '@solana/web3.js';
import type { NextRequest } from 'next/server';

export const AUTH_NONCE_COOKIE = 'merchplace_nonce';
export const AUTH_SESSION_COOKIE = 'merchplace_session';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type AuthMessageInput = {
  domain: string;
  uri: string;
  walletAddress: string;
  nonce: string;
  issuedAt: string;
  cluster: string;
};

type SessionPayload = {
  walletAddress: string;
  exp: number;
};

type FallbackAuthUser = {
  wallet_address: string;
  display_name: string | null;
};

type SignSessionInput = {
  walletAddress: string;
  secret: string;
  nowMs?: number;
};

type VerifySignatureInput = {
  walletAddress: string;
  message: string;
  signatureBase64: string;
};

function toWebCryptoBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function base64UrlEncode(value: string | Buffer): string {
  const buffer = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
  return buffer
    .toString('base64')
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

function base64UrlDecode(value: string): Buffer {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

function signValue(value: string, secret: string): string {
  return base64UrlEncode(createHmac('sha256', secret).update(value).digest());
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createNonce(): string {
  return base64UrlEncode(randomBytes(24));
}

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET or SUPABASE_SERVICE_ROLE_KEY is required in production');
  }

  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'merchplace-dev-secret';
}

export function createAuthMessage({
  domain,
  uri,
  walletAddress,
  nonce,
  issuedAt,
  cluster,
}: AuthMessageInput): string {
  return [
    `${domain} wants you to sign in to Merchplace.`,
    '',
    'This signature proves wallet ownership. It does not approve a transaction or move funds.',
    '',
    `Wallet: ${walletAddress}`,
    `URI: ${uri}`,
    `Cluster: ${cluster}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n');
}

export function buildFallbackAuthUser(
  walletAddress: string,
  displayName?: string
): FallbackAuthUser {
  const normalizedDisplayName = displayName?.trim();

  return {
    wallet_address: walletAddress,
    display_name: normalizedDisplayName || null,
  };
}

export function signSessionToken({
  walletAddress,
  secret,
  nowMs = Date.now(),
}: SignSessionInput): string {
  const payload: SessionPayload = {
    walletAddress,
    exp: nowMs + SESSION_TTL_MS,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${body}.${signValue(body, secret)}`;
}

export function verifySessionToken(
  token: string | undefined,
  secret: string,
  nowMs = Date.now()
): { walletAddress: string } | null {
  if (!token) return null;

  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  if (!safeEqual(signature, signValue(body, secret))) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(body).toString('utf8')) as SessionPayload;
    if (!payload.walletAddress || payload.exp < nowMs) return null;
    new PublicKey(payload.walletAddress);
    return { walletAddress: payload.walletAddress };
  } catch {
    return null;
  }
}

export function getSessionWallet(request: NextRequest): string | null {
  const token = request.cookies.get(AUTH_SESSION_COOKIE)?.value;
  return verifySessionToken(token, getAuthSecret())?.walletAddress ?? null;
}

export function requireSessionWallet(request: NextRequest): string {
  const wallet = getSessionWallet(request);
  if (!wallet) {
    throw new Error('Authentication required');
  }
  return wallet;
}

export async function verifyWalletSignature({
  walletAddress,
  message,
  signatureBase64,
}: VerifySignatureInput): Promise<boolean> {
  try {
    const publicKey = new PublicKey(walletAddress);
    const key = await crypto.subtle.importKey(
      'raw',
      toWebCryptoBuffer(publicKey.toBytes()),
      { name: 'Ed25519' },
      false,
      ['verify']
    );

    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      toWebCryptoBuffer(Buffer.from(signatureBase64, 'base64')),
      toWebCryptoBuffer(new TextEncoder().encode(message))
    );
  } catch {
    return false;
  }
}
