import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getHealthConfigReport } from '../lib/health.ts';

const completeEnv = {
  NEXT_PUBLIC_SOLANA_NETWORK: 'mainnet-beta',
  NEXT_PUBLIC_SOLANA_RPC_URL: 'https://mainnet.helius-rpc.com/?api-key=real',
  NEXT_PUBLIC_PROGRAM_ID: 'BWM5Sppg3Qu2mZCGM9ZiwWxDe9st3y4x3rb4Yur7Hauj',
  NEXT_PUBLIC_USDC_MINT: 'EPjFWdd5AufqSSqeM2qfM5mQGgVYx3fFXkNC4BJKsQm',
  NEXT_PUBLIC_TREASURY_WALLET: '8WfNuLGfFco74uReSdLTpmZzcsZrHUiYxNebADGwXyE1',
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  AUTH_SECRET: 'auth-secret',
};

test('health config passes when required production config exists', () => {
  const report = getHealthConfigReport(completeEnv);

  assert.equal(report.ok, true);
  assert.equal(report.network, 'mainnet-beta');
  assert.equal(report.checks.supabase, true);
});

test('health config fails without independent auth secret', () => {
  const report = getHealthConfigReport({
    ...completeEnv,
    AUTH_SECRET: undefined,
  });

  assert.equal(report.ok, false);
  assert.equal(report.checks.authSecret, false);
});
