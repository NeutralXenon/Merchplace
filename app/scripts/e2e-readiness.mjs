import fs from 'node:fs';
import path from 'node:path';
import {
  getManualWalletE2ESteps,
  getWalletE2EConfigIssues,
} from '../lib/e2eReadiness.ts';

const DEFAULT_BASE_URL = 'http://localhost:3004';
const ROUTES = [
  '/',
  '/listing/create',
  '/event/breakpoint-2025',
  '/listing/demo-1',
];

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

async function checkRoute(baseUrl, route) {
  const url = new URL(route, baseUrl).toString();

  try {
    const response = await fetch(url, { method: 'GET' });
    return { route, ok: response.ok, status: response.status };
  } catch (error) {
    return { route, ok: false, status: 0, error: error instanceof Error ? error.message : 'fetch failed' };
  }
}

async function checkListingsApi(baseUrl) {
  const url = new URL('/api/listings?limit=1', baseUrl).toString();

  try {
    const response = await fetch(url, { method: 'GET' });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : 'fetch failed' };
  }
}

const cwd = process.cwd();
const env = {
  ...readDotEnv(path.join(cwd, '.env.local')),
  ...process.env,
};
const baseUrl = process.env.E2E_BASE_URL || DEFAULT_BASE_URL;
const strict = process.argv.includes('--strict');

const issues = getWalletE2EConfigIssues(env);
const routeResults = await Promise.all(ROUTES.map((route) => checkRoute(baseUrl, route)));
const apiResult = await checkListingsApi(baseUrl);

console.log(`Wallet E2E readiness for ${baseUrl}`);
console.log('');

if (issues.length === 0) {
  console.log('Config: ready');
} else {
  console.log('Config issues:');
  issues.forEach((issue) => {
    console.log(`- ${issue.severity.toUpperCase()} ${issue.field}: ${issue.message}`);
  });
}

console.log('');
console.log('Route checks:');
routeResults.forEach((result) => {
  const status = result.ok ? 'OK' : 'BLOCKED';
  console.log(`- ${status} ${result.route} (${result.status || result.error})`);
});

console.log('');
if (apiResult.ok) {
  console.log(`Listings API: OK (${apiResult.status})`);
} else {
  console.log(`Listings API: unavailable (${apiResult.status || apiResult.error}); local fallback inventory can still support browser smoke checks.`);
}

console.log('');
console.log('Manual wallet E2E steps:');
getManualWalletE2ESteps().forEach((step, index) => {
  console.log(`${index + 1}. [${step.actor}] ${step.action}`);
  console.log(`   Expected: ${step.expected}`);
});

const hasBlockers =
  issues.some((issue) => issue.severity === 'blocker') ||
  routeResults.some((result) => !result.ok);

if (strict && hasBlockers) {
  process.exitCode = 1;
}
