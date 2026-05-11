import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  REQUIRED_SUPABASE_BUCKET,
  REQUIRED_SUPABASE_TABLES,
  getSupabaseConfigIssues,
  getSupabaseErrorHint,
  getSupabaseSetupSteps,
  maskSupabaseOrigin,
} from '../lib/supabaseReadiness.ts';

const VALID_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://exampleproject.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};

function fakeSupabaseJwt(ref) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString(
    'base64url'
  );
  const payload = Buffer.from(JSON.stringify({ ref, role: 'service_role' })).toString(
    'base64url'
  );
  return `${header}.${payload}.signature`;
}

test('accepts a complete Supabase configuration', () => {
  assert.deepEqual(getSupabaseConfigIssues(VALID_ENV), []);
});

test('blocks missing or placeholder Supabase credentials', () => {
  const issues = getSupabaseConfigIssues({
    NEXT_PUBLIC_SUPABASE_URL: 'YOUR_SUPABASE_URL',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
    SUPABASE_SERVICE_ROLE_KEY: 'your-service-role-key',
  });

  assert.equal(issues.length, 3);
  assert.ok(issues.every((issue) => issue.severity === 'blocker'));
});

test('blocks Supabase keys copied from a different project ref', () => {
  const issues = getSupabaseConfigIssues({
    NEXT_PUBLIC_SUPABASE_URL: 'https://newproject.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: fakeSupabaseJwt('oldproject'),
    SUPABASE_SERVICE_ROLE_KEY: fakeSupabaseJwt('oldproject'),
  });

  assert.equal(issues.length, 2);
  assert.ok(issues.every((issue) => issue.message.includes('oldproject')));
  assert.ok(issues.every((issue) => issue.message.includes('newproject')));
});

test('documents the required database and storage surface', () => {
  assert.deepEqual(REQUIRED_SUPABASE_TABLES, [
    'users',
    'listings',
    'shipping',
    'listing_events',
  ]);
  assert.equal(REQUIRED_SUPABASE_BUCKET, 'listing-images');
});

test('explains unresolved Supabase project hosts without leaking keys', () => {
  const hint = getSupabaseErrorHint({
    code: 'ENOTFOUND',
    hostname: 'ieosqlvesrdifzbrnosq.supabase.co',
  });

  assert.match(hint, /could not be resolved/i);
  assert.match(hint, /Settings.*API/i);
  assert.ok(!hint.includes('service-role-key'));
});

test('masks the Supabase origin in console output', () => {
  assert.equal(
    maskSupabaseOrigin('https://exampleproject.supabase.co'),
    'https://exam...ject.supabase.co'
  );
  assert.equal(maskSupabaseOrigin('not-a-url'), 'invalid Supabase URL');
});

test('setup steps cover schema, storage, and verification', () => {
  const steps = getSupabaseSetupSteps();

  assert.ok(steps.some((step) => step.includes('schema.sql')));
  assert.ok(steps.some((step) => step.includes(REQUIRED_SUPABASE_BUCKET)));
  assert.ok(steps.some((step) => step.includes('npm run supabase:check')));
});
