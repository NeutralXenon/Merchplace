import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import {
  AUTH_NONCE_COOKIE,
  createAuthMessage,
  createNonce,
} from '@/lib/auth';
import { getSolanaCluster } from '@/lib/solanaDisplay';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { wallet_address?: string };
    const walletAddress = body.wallet_address;

    if (!walletAddress) {
      return NextResponse.json({ error: 'Missing wallet_address' }, { status: 400 });
    }

    try {
      new PublicKey(walletAddress);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet_address' }, { status: 400 });
    }

    const nonce = createNonce();
    const issuedAt = new Date().toISOString();
    const origin = request.nextUrl.origin;
    const domain = request.headers.get('host') || new URL(origin).host;
    const cluster = getSolanaCluster();
    const message = createAuthMessage({
      domain,
      uri: origin,
      walletAddress,
      nonce,
      issuedAt,
      cluster,
    });

    const response = NextResponse.json({ message, nonce, issued_at: issuedAt, cluster });
    response.cookies.set(AUTH_NONCE_COOKIE, nonce, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60,
      path: '/',
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Failed to create nonce' }, { status: 500 });
  }
}
