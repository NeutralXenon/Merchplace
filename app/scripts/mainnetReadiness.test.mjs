import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMainnetReadiness,
  isValidPublicKey,
  isProductionRpc,
  MAINNET_READINESS_TEST_TREASURY,
} from '../lib/mainnetReadiness.ts';

const productionEnv = {
  NEXT_PUBLIC_SOLANA_NETWORK: 'mainnet-beta',
  NEXT_PUBLIC_SOLANA_RPC_URL: 'https://mainnet.helius-rpc.com/?api-key=real',
  NEXT_PUBLIC_PROGRAM_ID: 'BWM5Sppg3Qu2mZCGM9ZiwWxDe9st3y4x3rb4Yur7Hauj',
  NEXT_PUBLIC_USDC_MINT: 'EPjFWdd5AufqSSqeM2qfM5mQGgVYx3fFXkNC4BJKsQm',
  NEXT_PUBLIC_TREASURY_WALLET: '8WfNuLGfFco74uReSdLTpmZzcsZrHUiYxNebADGwXyE1',
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  AUTH_SECRET: 'production-auth-secret',
};

const deployedContext = [
  '| Devnet deployed | Yes |',
  '| Mainnet deployed | No |',
  '| Browser wallet E2E | Verified on localnet |',
].join('\n');

test('production RPC rejects localnet, devnet, and public mainnet endpoints', () => {
  assert.equal(isProductionRpc('http://127.0.0.1:8899'), false);
  assert.equal(isProductionRpc('https://api.devnet.solana.com'), false);
  assert.equal(isProductionRpc('https://api.mainnet-beta.solana.com'), false);
  assert.equal(isProductionRpc('https://mainnet.helius-rpc.com/?api-key=real'), true);
});

test('public key readiness validation rejects malformed addresses', () => {
  assert.equal(isValidPublicKey('8WfNuLGfFco74uReSdLTpmZzcsZrHUiYxNebADGwXyE1'), true);
  assert.equal(isValidPublicKey('not-a-wallet'), false);
  assert.equal(isValidPublicKey(undefined), false);
});

test('mainnet readiness passes with production env, devnet proof, and ignored env files', () => {
  const report = getMainnetReadiness({
    env: productionEnv,
    buildContext: deployedContext,
    gitignore: '.env*\n.next\n',
    trackedEnvFiles: [],
    dependencyAudit: { passed: true },
  });

  assert.equal(report.ready, true);
  assert.equal(report.blockers.length, 0);
});

test('mainnet readiness blocks the current localnet-style environment', () => {
  const report = getMainnetReadiness({
    env: {
      ...productionEnv,
      NEXT_PUBLIC_SOLANA_NETWORK: 'localnet',
      NEXT_PUBLIC_SOLANA_RPC_URL: 'http://127.0.0.1:8899',
      NEXT_PUBLIC_USDC_MINT: 'BabWrnHnNyjbRPbn7EQVpApUq8GhmtPu54C99aV2E7A9',
      NEXT_PUBLIC_TREASURY_WALLET: MAINNET_READINESS_TEST_TREASURY,
      AUTH_SECRET: undefined,
    },
    buildContext: '| Devnet deployed | No |',
    gitignore: 'node_modules\n',
    trackedEnvFiles: ['.env.local'],
    dependencyAudit: { passed: false, summary: 'bigint-buffer high severity' },
  });

  assert.equal(report.ready, false);
  assert.ok(report.blockers.some((issue) => /devnet/i.test(issue.message)));
  assert.ok(report.blockers.some((issue) => /mainnet-beta/i.test(issue.message)));
  assert.ok(report.blockers.some((issue) => /production RPC/i.test(issue.message)));
  assert.ok(report.blockers.some((issue) => /browser-wallet/i.test(issue.id)));
  assert.ok(report.blockers.some((issue) => /USDC/i.test(issue.message)));
  assert.ok(report.blockers.some((issue) => /treasury/i.test(issue.message)));
  assert.ok(report.blockers.some((issue) => /AUTH_SECRET/i.test(issue.message)));
  assert.ok(report.blockers.some((issue) => /dependency/i.test(issue.id)));
  assert.ok(report.blockers.some((issue) => /env/i.test(issue.message)));
});
