import { PublicKey } from '@solana/web3.js';

export const MAINNET_READINESS_TEST_TREASURY = 'GMjnAmWpvW55ffM635MTKY3VAGXbmnpRBJ6NyqjKrMwb';
export const MAINNET_USDC_MINT = 'EPjFWdd5AufqSSqeM2qfM5mQGgVYx3fFXkNC4BJKsQm';

type MainnetEnv = Record<string, string | undefined>;

export type MainnetReadinessIssue = {
  id: string;
  message: string;
  severity: 'blocker' | 'warning';
};

export type MainnetReadinessReport = {
  ready: boolean;
  blockers: MainnetReadinessIssue[];
  warnings: MainnetReadinessIssue[];
};

type DependencyAuditInput = {
  passed: boolean;
  summary?: string;
};

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

function hasDevnetProof(buildContext: string): boolean {
  return /\|\s*Devnet deployed\s*\|\s*Yes\s*\|/i.test(buildContext);
}

function hasBrowserWalletProof(buildContext: string): boolean {
  return buildContext
    .split(/\r?\n/)
    .some((line) => /browser wallet e2e/i.test(line) && /(verified|pass)/i.test(line));
}

function ignoresEnvFiles(gitignore: string): boolean {
  return gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === '.env*' || line === '*.env' || line === '.env.local');
}

export function isProductionRpc(rpcUrl: string | undefined): boolean {
  const normalized = rpcUrl?.toLowerCase() ?? '';
  if (!normalized.startsWith('https://')) return false;
  if (normalized.includes('localhost') || normalized.includes('127.0.0.1')) return false;
  if (normalized.includes('devnet') || normalized.includes('testnet')) return false;
  if (normalized === 'https://api.mainnet-beta.solana.com') return false;

  return (
    normalized.includes('helius') ||
    normalized.includes('quicknode') ||
    normalized.includes('triton') ||
    normalized.includes('chainstack')
  );
}

export function isValidPublicKey(value: string | undefined): boolean {
  if (!value || value.trim().length === 0) return false;
  const publicKey = value.trim();

  try {
    new PublicKey(publicKey);
    return true;
  } catch {
    return false;
  }
}

export function getMainnetReadiness({
  env,
  buildContext,
  gitignore,
  trackedEnvFiles,
  dependencyAudit,
}: {
  env: MainnetEnv;
  buildContext: string;
  gitignore: string;
  trackedEnvFiles: string[];
  dependencyAudit?: DependencyAuditInput;
}): MainnetReadinessReport {
  const blockers: MainnetReadinessIssue[] = [];
  const warnings: MainnetReadinessIssue[] = [];

  if (!hasDevnetProof(buildContext)) {
    blockers.push({
      id: 'devnet-proof',
      severity: 'blocker',
      message: 'Devnet deployment and devnet lifecycle verification are required before mainnet.',
    });
  }

  if (!hasBrowserWalletProof(buildContext)) {
    blockers.push({
      id: 'browser-wallet-proof',
      severity: 'blocker',
      message: 'A real browser-wallet create/buy/ship/receipt flow must be verified before mainnet.',
    });
  }

  if (env.NEXT_PUBLIC_SOLANA_NETWORK !== 'mainnet-beta') {
    blockers.push({
      id: 'mainnet-network',
      severity: 'blocker',
      message: 'NEXT_PUBLIC_SOLANA_NETWORK must be mainnet-beta for a production build.',
    });
  }

  if (!isProductionRpc(env.NEXT_PUBLIC_SOLANA_RPC_URL)) {
    blockers.push({
      id: 'production-rpc',
      severity: 'blocker',
      message: 'A production RPC provider is required; localnet, devnet, and public mainnet RPC are not enough.',
    });
  }

  if (!isValidPublicKey(env.NEXT_PUBLIC_PROGRAM_ID)) {
    blockers.push({
      id: 'program-id',
      severity: 'blocker',
      message: 'NEXT_PUBLIC_PROGRAM_ID must be a valid deployed mainnet program address.',
    });
  }

  if (env.NEXT_PUBLIC_USDC_MINT !== MAINNET_USDC_MINT) {
    blockers.push({
      id: 'usdc-mint',
      severity: 'blocker',
      message: `NEXT_PUBLIC_USDC_MINT must be the Solana mainnet USDC mint ${MAINNET_USDC_MINT}.`,
    });
  }

  if (
    !isValidPublicKey(env.NEXT_PUBLIC_TREASURY_WALLET) ||
    env.NEXT_PUBLIC_TREASURY_WALLET === MAINNET_READINESS_TEST_TREASURY
  ) {
    blockers.push({
      id: 'treasury',
      severity: 'blocker',
      message: 'Replace the generated local test treasury with a project-owned production treasury.',
    });
  }

  if (dependencyAudit?.passed === false) {
    blockers.push({
      id: 'dependency-audit',
      severity: 'blocker',
      message: dependencyAudit.summary
        ? `Resolve high-severity dependency audit issues before mainnet: ${dependencyAudit.summary}`
        : 'Resolve high-severity dependency audit issues before mainnet.',
    });
  }

  if (isBlank(env.AUTH_SECRET)) {
    blockers.push({
      id: 'auth-secret',
      severity: 'blocker',
      message: 'AUTH_SECRET must be set in production instead of falling back to the Supabase service role key.',
    });
  }

  if (
    isBlank(env.NEXT_PUBLIC_SUPABASE_URL) ||
    isBlank(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
    isBlank(env.SUPABASE_SERVICE_ROLE_KEY)
  ) {
    blockers.push({
      id: 'supabase',
      severity: 'blocker',
      message: 'Production Supabase URL, anon key, and service role key are required.',
    });
  }

  if (!ignoresEnvFiles(gitignore)) {
    blockers.push({
      id: 'env-gitignore',
      severity: 'blocker',
      message: '.env files must be ignored before production secrets are added.',
    });
  }

  if (trackedEnvFiles.length > 0) {
    blockers.push({
      id: 'tracked-env',
      severity: 'blocker',
      message: `Tracked env files must be removed from git: ${trackedEnvFiles.join(', ')}`,
    });
  }

  warnings.push({
    id: 'authority-plan',
    severity: 'warning',
    message: 'Decide and document upgrade authority custody before deploying: hardware wallet now, Squads multisig soon.',
  });

  warnings.push({
    id: 'monitoring',
    severity: 'warning',
    message: 'Add production transaction/error monitoring before public launch.',
  });

  return {
    ready: blockers.length === 0,
    blockers,
    warnings,
  };
}
