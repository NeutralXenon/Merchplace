type HealthEnv = Record<string, string | undefined>;

export type HealthCheckName =
  | 'solanaNetwork'
  | 'solanaRpc'
  | 'programId'
  | 'usdcMint'
  | 'treasury'
  | 'supabase'
  | 'authSecret';

export type HealthConfigReport = {
  ok: boolean;
  network: string | null;
  checks: Record<HealthCheckName, boolean>;
};

function present(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0);
}

export function getHealthConfigReport(env: HealthEnv): HealthConfigReport {
  const checks = {
    solanaNetwork: present(env.NEXT_PUBLIC_SOLANA_NETWORK),
    solanaRpc: present(env.NEXT_PUBLIC_SOLANA_RPC_URL),
    programId: present(env.NEXT_PUBLIC_PROGRAM_ID),
    usdcMint: present(env.NEXT_PUBLIC_USDC_MINT),
    treasury: present(env.NEXT_PUBLIC_TREASURY_WALLET),
    supabase:
      present(env.NEXT_PUBLIC_SUPABASE_URL) &&
      present(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
      present(env.SUPABASE_SERVICE_ROLE_KEY),
    authSecret: present(env.AUTH_SECRET),
  };

  return {
    ok: Object.values(checks).every(Boolean),
    network: env.NEXT_PUBLIC_SOLANA_NETWORK || null,
    checks,
  };
}
