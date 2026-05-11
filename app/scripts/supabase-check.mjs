import dns from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  REQUIRED_SUPABASE_BUCKET,
  REQUIRED_SUPABASE_TABLES,
  getSupabaseConfigIssues,
  getSupabaseErrorHint,
  getSupabaseSetupSteps,
  maskSupabaseOrigin,
} from '../lib/supabaseReadiness.ts';

function readDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;

      const separator = trimmed.indexOf('=');
      if (separator === -1) return acc;

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
      acc[key] = value;
      return acc;
    }, {});
}

async function checkDns(supabaseUrl) {
  const hostname = new URL(supabaseUrl).hostname;
  await dns.lookup(hostname);
}

async function checkTable(supabase, table) {
  const { error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  return {
    name: table,
    ok: !error,
    error,
  };
}

async function checkBucket(supabase) {
  const { data, error } = await supabase.storage.getBucket(REQUIRED_SUPABASE_BUCKET);

  return {
    name: REQUIRED_SUPABASE_BUCKET,
    ok: !error && data?.public === true,
    error,
    public: data?.public === true,
  };
}

const cwd = process.cwd();
const env = {
  ...readDotEnv(path.join(cwd, '.env.local')),
  ...process.env,
};

const issues = getSupabaseConfigIssues(env);
let failed = issues.some((issue) => issue.severity === 'blocker');

console.log(`Supabase readiness for ${maskSupabaseOrigin(env.NEXT_PUBLIC_SUPABASE_URL)}`);
console.log('');

if (issues.length === 0) {
  console.log('Config: ready');
} else {
  console.log('Config issues:');
  issues.forEach((issue) => {
    console.log(`- ${issue.severity.toUpperCase()} ${issue.field}: ${issue.message}`);
  });
}

if (!failed) {
  console.log('');
  try {
    await checkDns(env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('DNS: OK');
  } catch (error) {
    failed = true;
    console.log(`DNS: BLOCKED - ${getSupabaseErrorHint(error)}`);
  }
}

if (!failed) {
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  console.log('');
  console.log('Tables:');
  const tableResults = await Promise.all(
    REQUIRED_SUPABASE_TABLES.map((table) => checkTable(supabase, table))
  );
  tableResults.forEach((result) => {
    if (result.ok) {
      console.log(`- OK ${result.name}`);
    } else {
      failed = true;
      console.log(`- BLOCKED ${result.name}: ${result.error.message}`);
      console.log(`  ${getSupabaseErrorHint(result.error)}`);
    }
  });

  console.log('');
  console.log('Storage:');
  const bucket = await checkBucket(supabase);
  if (bucket.ok) {
    console.log(`- OK ${bucket.name} (public)`);
  } else {
    failed = true;
    const reason = bucket.error?.message || 'bucket is not public';
    console.log(`- BLOCKED ${bucket.name}: ${reason}`);
    console.log(`  ${getSupabaseErrorHint(bucket.error || reason)}`);
  }
}

if (failed) {
  console.log('');
  console.log('Setup checklist:');
  getSupabaseSetupSteps().forEach((step, index) => {
    console.log(`${index + 1}. ${step}`);
  });
  process.exitCode = 1;
} else {
  console.log('');
  console.log('Supabase: connected');
}
