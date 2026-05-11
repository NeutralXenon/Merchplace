# Mainnet Runbook

Merchplace is devnet verified, but not mainnet ready until the readiness checker passes with a private production env file and the deploy transaction is explicitly approved.

## Current Gate

From `app/`:

```bash
npm run mainnet:check
```

To check a production env file without overwriting local development config:

```bash
MAINNET_ENV_FILE=.env.production npm run mainnet:check
```

Use `app/.env.mainnet.example` as the template. Real secrets must stay out of git.

## Required Mainnet Inputs

- Paid production Solana RPC, not public mainnet RPC.
- Mainnet program ID after explicit mainnet deploy approval.
- Mainnet USDC mint: `EPjFWdd5AufqSSqeM2qfM5mQGgVYx3fFXkNC4BJKsQm`.
- Project-owned treasury wallet public key.
- Production Supabase URL, anon key, and service role key.
- Independent `AUTH_SECRET`; do not reuse the Supabase service role key.
- Upgrade authority custody decision.

## Pre-Deploy

1. Run the full verification set:

```bash
NO_DNA=1 anchor test --skip-local-validator --skip-deploy
cd app
npm run lint
npm run build
npm audit --audit-level=high --omit=dev
npm run mainnet:check
```

2. Confirm upgrade authority custody:
   - Use a dedicated deployer wallet, not a daily wallet.
   - Prefer hardware wallet custody for launch.
   - Move upgrade authority to Squads multisig after initial stabilization.
   - Do not freeze authority until the program has real usage, monitoring, and review history.

3. Capture build artifact hash:

```bash
shasum -a 256 target/deploy/merchplace.so
```

## Deploy

Do not run this without explicit approval in the current conversation:

```bash
NO_DNA=1 anchor deploy --provider.cluster mainnet-beta
```

After deploy, verify:

```bash
solana program show <PROGRAM_ID> --url <PRODUCTION_RPC_URL>
```

## Post-Deploy

- Update the private production env with the deployed mainnet program ID.
- Rebuild the app with production env.
- Run `MAINNET_ENV_FILE=.env.production npm run mainnet:check`.
- Create one tiny real-wallet production listing only after reviewing the wallet transaction summary.
- Verify Supabase sync and listing visibility.
- Configure uptime monitoring against `/api/health`; alert on non-200 responses.
- Monitor failed `/api/listings` and `/api/listings/[id]` sync responses.
- Keep a manual recovery note for "on-chain succeeded, Supabase sync failed" cases.
