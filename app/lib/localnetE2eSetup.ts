type LocalnetSetupArgs = Record<string, string>;

type LocalnetSetupEnv = Record<string, string | undefined>;

export type LocalnetSetupPlan = {
  checkOnly: boolean;
  mint?: string;
  treasury?: string;
  shouldCreateMint: boolean;
  shouldUpdateEnv: boolean;
  shouldFundWallets: boolean;
};

export function parseLocalnetSetupArgs(argv: string[]): LocalnetSetupArgs {
  const args: LocalnetSetupArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) continue;

    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      args[key] = 'true';
    } else {
      args[key] = next;
      index += 1;
    }
  }

  return args;
}

export function isTruthyFlag(value: string | undefined): boolean {
  return value === 'true' || value === '1' || value === 'yes';
}

export function readEnvValue(contents: string, key: string): string | undefined {
  const line = contents
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${key}=`));
  if (!line) return undefined;

  const value = line.slice(line.indexOf('=') + 1).trim();
  return value.replace(/^['"]|['"]$/g, '') || undefined;
}

export function getLocalnetSetupPlan({
  args,
  env,
}: {
  args: LocalnetSetupArgs;
  env: LocalnetSetupEnv;
}): LocalnetSetupPlan {
  const checkOnly = isTruthyFlag(args['check-only']);
  const mint = args.mint || env.NEXT_PUBLIC_USDC_MINT;

  return {
    checkOnly,
    mint,
    treasury: args.treasury || env.NEXT_PUBLIC_TREASURY_WALLET,
    shouldCreateMint: !checkOnly && !args.mint,
    shouldUpdateEnv: !checkOnly,
    shouldFundWallets: !checkOnly,
  };
}
