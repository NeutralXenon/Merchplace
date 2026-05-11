import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { getMainnetReadiness } from '../lib/mainnetReadiness.ts';

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

function getTrackedEnvFiles(cwd) {
  try {
    return execFileSync('git', ['ls-files', '.env', '.env.*', '../.env', '../.env.*'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
      .trim()
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function summarizeAudit(jsonText) {
  try {
    const report = JSON.parse(jsonText);
    const high = report.metadata?.vulnerabilities?.high ?? 0;
    const critical = report.metadata?.vulnerabilities?.critical ?? 0;
    const vulnerablePackages = Object.values(report.vulnerabilities ?? {})
      .filter((item) => item?.severity === 'high' || item?.severity === 'critical')
      .map((item) => item.name)
      .filter(Boolean);

    return {
      passed: high === 0 && critical === 0,
      summary:
        high === 0 && critical === 0
          ? undefined
          : `${critical} critical, ${high} high (${vulnerablePackages.join(', ') || 'package details unavailable'})`,
    };
  } catch {
    return {
      passed: false,
      summary: 'npm audit did not return parseable JSON',
    };
  }
}

function runDependencyAudit(cwd) {
  try {
    const output = execFileSync('npm', ['audit', '--audit-level=high', '--omit=dev', '--json'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return summarizeAudit(output);
  } catch (error) {
    const output = error?.stdout?.toString?.() ?? '';
    if (output) return summarizeAudit(output);

    return {
      passed: false,
      summary: 'npm audit --audit-level=high --omit=dev failed before producing a report',
    };
  }
}

const cwd = process.cwd();
const workspaceRoot = path.resolve(cwd, '..');
const envFilePath = process.env.MAINNET_ENV_FILE
  ? path.resolve(cwd, process.env.MAINNET_ENV_FILE)
  : path.join(cwd, '.env.local');
const env = {
  ...readDotEnv(envFilePath),
  ...process.env,
};
const buildContextPath = path.join(workspaceRoot, '.superstack', 'build-context.md');
const buildContext = fs.existsSync(buildContextPath)
  ? fs.readFileSync(buildContextPath, 'utf8')
  : '';
const gitignore = [
  fs.existsSync(path.join(workspaceRoot, '.gitignore'))
    ? fs.readFileSync(path.join(workspaceRoot, '.gitignore'), 'utf8')
    : '',
  fs.existsSync(path.join(cwd, '.gitignore'))
    ? fs.readFileSync(path.join(cwd, '.gitignore'), 'utf8')
    : '',
].join('\n');

const report = getMainnetReadiness({
  env,
  buildContext,
  gitignore,
  trackedEnvFiles: getTrackedEnvFiles(cwd),
  dependencyAudit: runDependencyAudit(cwd),
});

console.log('Mainnet readiness check');
console.log(`Env file: ${path.relative(cwd, envFilePath) || '.env.local'}`);
console.log(`Status: ${report.ready ? 'READY' : 'NOT READY'}`);

if (report.blockers.length > 0) {
  console.log('');
  console.log('Blockers:');
  report.blockers.forEach((issue) => console.log(`- [${issue.id}] ${issue.message}`));
}

if (report.warnings.length > 0) {
  console.log('');
  console.log('Warnings:');
  report.warnings.forEach((issue) => console.log(`- [${issue.id}] ${issue.message}`));
}

process.exit(report.ready ? 0 : 1);
