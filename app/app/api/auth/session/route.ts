import { NextRequest, NextResponse } from 'next/server';
import { getSessionWallet } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const wallet_address = getSessionWallet(request);
  return NextResponse.json({
    authenticated: Boolean(wallet_address),
    wallet_address,
  });
}
