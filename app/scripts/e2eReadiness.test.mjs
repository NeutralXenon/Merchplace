import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  getManualWalletE2ESteps,
  getWalletE2EConfigIssues,
} from '../lib/e2eReadiness.ts';

const VALID_ENV = {
  NEXT_PUBLIC_SOLANA_RPC_URL: 'http://127.0.0.1:8899',
  NEXT_PUBLIC_SOLANA_NETWORK: 'localnet',
  NEXT_PUBLIC_PROGRAM_ID: 'BWM5Sppg3Qu2mZCGM9ZiwWxDe9st3y4x3rb4Yur7Hauj',
  NEXT_PUBLIC_USDC_MINT: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
  NEXT_PUBLIC_TREASURY_WALLET: '11111111111111111111111111111111',
};

test('accepts a complete localnet wallet E2E configuration', () => {
  assert.deepEqual(getWalletE2EConfigIssues(VALID_ENV), []);
});

test('blocks placeholder treasury wallet before wallet E2E', () => {
  const issues = getWalletE2EConfigIssues({
    ...VALID_ENV,
    NEXT_PUBLIC_TREASURY_WALLET: 'YOUR_TREASURY_WALLET_ADDRESS_HERE',
  });

  assert.equal(issues.length, 1);
  assert.equal(issues[0].severity, 'blocker');
  assert.equal(issues[0].field, 'NEXT_PUBLIC_TREASURY_WALLET');
  assert.match(issues[0].message, /real treasury wallet/i);
});

test('flags invalid public keys in wallet E2E config', () => {
  const issues = getWalletE2EConfigIssues({
    ...VALID_ENV,
    NEXT_PUBLIC_PROGRAM_ID: 'not-a-public-key',
  });

  assert.equal(issues[0].severity, 'blocker');
  assert.equal(issues[0].field, 'NEXT_PUBLIC_PROGRAM_ID');
});

test('documents the full manual wallet lifecycle', () => {
  const steps = getManualWalletE2ESteps();

  assert.deepEqual(
    steps.map((step) => step.id),
    [
      'seller-connect',
      'create-listing',
      'buyer-connect',
      'buy-listing',
      'seller-tracking',
      'buyer-final-state',
    ]
  );
  assert.ok(steps.some((step) => step.action.includes('confirm receipt or cancel')));
});
