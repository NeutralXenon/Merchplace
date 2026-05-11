import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getLocalnetSetupPlan,
  parseLocalnetSetupArgs,
  readEnvValue,
} from '../lib/localnetE2eSetup.ts';

test('parses boolean flags without consuming the next option', () => {
  const args = parseLocalnetSetupArgs([
    '--check-only',
    '--seller',
    'Seller111111111111111111111111111111111111',
    '--buyer',
    'Buyer1111111111111111111111111111111111111',
  ]);

  assert.equal(args['check-only'], 'true');
  assert.equal(args.seller, 'Seller111111111111111111111111111111111111');
  assert.equal(args.buyer, 'Buyer1111111111111111111111111111111111111');
});

test('check-only setup plan is read-only and reuses the configured mint', () => {
  const plan = getLocalnetSetupPlan({
    args: parseLocalnetSetupArgs(['--check-only']),
    env: {
      NEXT_PUBLIC_USDC_MINT: 'Mint11111111111111111111111111111111111111',
      NEXT_PUBLIC_TREASURY_WALLET: 'Treasury1111111111111111111111111111111111',
    },
  });

  assert.equal(plan.checkOnly, true);
  assert.equal(plan.shouldCreateMint, false);
  assert.equal(plan.shouldUpdateEnv, false);
  assert.equal(plan.shouldFundWallets, false);
  assert.equal(plan.mint, 'Mint11111111111111111111111111111111111111');
});

test('normal setup plan mutates localnet env and creates a mint when none is supplied', () => {
  const plan = getLocalnetSetupPlan({
    args: parseLocalnetSetupArgs([]),
    env: {},
  });

  assert.equal(plan.checkOnly, false);
  assert.equal(plan.shouldCreateMint, true);
  assert.equal(plan.shouldUpdateEnv, true);
  assert.equal(plan.shouldFundWallets, true);
  assert.equal(plan.mint, undefined);
});

test('reads env values from .env.local text without exposing unrelated keys', () => {
  const contents = [
    'NEXT_PUBLIC_USDC_MINT=Mint11111111111111111111111111111111111111',
    'SUPABASE_SERVICE_ROLE_KEY=do-not-read',
  ].join('\n');

  assert.equal(
    readEnvValue(contents, 'NEXT_PUBLIC_USDC_MINT'),
    'Mint11111111111111111111111111111111111111'
  );
  assert.equal(readEnvValue(contents, 'NEXT_PUBLIC_TREASURY_WALLET'), undefined);
});
