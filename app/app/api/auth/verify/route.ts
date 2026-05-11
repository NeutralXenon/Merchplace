import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import {
  AUTH_NONCE_COOKIE,
  AUTH_SESSION_COOKIE,
  buildFallbackAuthUser,
  getAuthSecret,
  signSessionToken,
  verifyWalletSignature,
} from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { getSolanaCluster } from '@/lib/solanaDisplay';
import { createServerClient } from '@/lib/supabase';

/**
 * POST /api/auth/verify
 * Verify a wallet owns a given address with a nonce-bound signed message.
 *
 * Body:
 * - wallet_address: string
 * - message: string
 * - signature: base64 string
 * - display_name: string (optional)
 *
 * This upserts the user record and returns the user data.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      wallet_address?: string;
      message?: string;
      signature?: string;
      display_name?: string;
    };

    const { wallet_address, message, signature, display_name } = body;

    if (!wallet_address || !message || !signature) {
      return NextResponse.json(
        { error: 'Missing wallet_address, message, or signature' },
        { status: 400 }
      );
    }

    try {
      new PublicKey(wallet_address);
    } catch {
      return NextResponse.json({ error: 'Invalid wallet_address' }, { status: 400 });
    }

    const nonce = request.cookies.get(AUTH_NONCE_COOKIE)?.value;
    if (!nonce || !message.includes(`Nonce: ${nonce}`)) {
      return NextResponse.json({ error: 'Invalid or expired nonce' }, { status: 401 });
    }

    const origin = request.nextUrl.origin;
    const domain = request.headers.get('host') || new URL(origin).host;
    const expectedFragments = [
      `${domain} wants you to sign in to Merchplace.`,
      'This signature proves wallet ownership. It does not approve a transaction or move funds.',
      `Wallet: ${wallet_address}`,
      `URI: ${origin}`,
      `Cluster: ${getSolanaCluster()}`,
      `Nonce: ${nonce}`,
    ];
    if (!expectedFragments.every((fragment) => message.includes(fragment))) {
      return NextResponse.json({ error: 'Invalid auth message' }, { status: 401 });
    }

    const validSignature = await verifyWalletSignature({
      walletAddress: wallet_address,
      message,
      signatureBase64: signature,
    });
    if (!validSignature) {
      return NextResponse.json({ error: 'Invalid wallet signature' }, { status: 401 });
    }

    // Profile persistence is useful, but wallet auth must not depend on the
    // database being reachable during local/offline development.
    const updateData: {
      wallet_address: string;
      display_name?: string;
    } = {
      wallet_address,
    };
    if (display_name) {
      updateData.display_name = display_name;
    }

    let user = buildFallbackAuthUser(wallet_address, display_name);
    let profileSync: 'synced' | 'deferred' = 'deferred';

    try {
      const supabase = createServerClient();
      const { data, error } = await supabase
        .from('users')
        .upsert(updateData, { onConflict: 'wallet_address' })
        .select()
        .single();

      if (error) {
        console.warn('Auth profile sync skipped:', error.message);
      } else if (data) {
        user = data;
        profileSync = 'synced';
      }
    } catch (err: unknown) {
      console.warn('Auth profile sync unavailable:', getErrorMessage(err, 'Profile sync failed'));
    }

    const response = NextResponse.json({ user, profile_sync: profileSync });
    response.cookies.set(
      AUTH_SESSION_COOKIE,
      signSessionToken({
        walletAddress: wallet_address,
        secret: getAuthSecret(),
      }),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      }
    );
    response.cookies.delete(AUTH_NONCE_COOKIE);

    return response;
  } catch (err: unknown) {
    console.error('POST /api/auth/verify error:', err);
    return NextResponse.json(
      { error: getErrorMessage(err, 'Verification failed') },
      { status: 500 }
    );
  }
}
