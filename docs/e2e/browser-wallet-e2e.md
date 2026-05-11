# Browser Wallet E2E Runbook

This runbook covers the manual wallet path that cannot be honestly automated without controlling a wallet extension and signing transactions.

## Readiness

From `app/`:

```bash
npm run e2e:readiness
```

Use strict mode when the local app and wallet environment should be ready:

```bash
npm run e2e:readiness -- --strict
```

The readiness script checks:

- Required Solana public environment values exist and are valid public keys.
- Treasury wallet is not left as a placeholder.
- Local browser routes are reachable.
- Listings API status is visible; if Supabase is unavailable, local fallback inventory can still support smoke checks.

## Localnet Setup

From the workspace root, start a validator with the merchplace program loaded:

```bash
npm run localnet:e2e-validator
```

In a second terminal, configure the app for localnet and create a fresh 6-decimal test USDC mint:

```bash
cd app
npm run localnet:e2e-setup
```

To fund browser wallets for the manual flow, pass their public keys:

```bash
npm run localnet:e2e-setup -- --seller <SELLER_WALLET> --buyer <BUYER_WALLET>
```

The setup script airdrops local SOL and mints test USDC to the provided wallets. After it updates `.env.local`, rebuild and restart the app because Next.js bakes `NEXT_PUBLIC_*` values into the client bundle:

```bash
npm run build
npm run start -- --port 3012
```

Run strict readiness against that server:

```bash
E2E_BASE_URL=http://localhost:3012 npm run e2e:readiness -- --strict
```

## Automated Publish Smoke

Before the manual wallet-extension pass, run the generated-wallet publish smoke from `app/`:

```bash
E2E_BASE_URL=http://localhost:3012 npm run e2e:publish-smoke -- --send-localnet-tx
```

This command only runs on `NEXT_PUBLIC_SOLANA_NETWORK=localnet` with a localhost RPC URL. It generates a throwaway seller wallet, airdrops local SOL, simulates and sends an on-chain `createListing`, signs into the app with that generated wallet, and posts the listing metadata to `/api/listings`. The backend must verify the transaction before Supabase marks the listing live.

To exercise the verified purchase and receipt-confirmation sync paths too:

```bash
E2E_BASE_URL=http://localhost:3012 npm run e2e:publish-smoke -- --send-localnet-tx --full-lifecycle
```

The full lifecycle variant also generates a buyer wallet, mints local test USDC to it using the local Solana CLI mint authority, buys the listing, and confirms receipt. Supabase must move the listing through `available -> in_escrow -> sold`.

To test the refund path instead:

```bash
E2E_BASE_URL=http://localhost:3012 npm run e2e:publish-smoke -- --send-localnet-tx --cancel-purchase
```

That variant moves Supabase through `available -> in_escrow -> available` after the buyer cancellation transaction.

To test seller cancellation before purchase:

```bash
E2E_BASE_URL=http://localhost:3012 npm run e2e:publish-smoke -- --send-localnet-tx --cancel-listing
```

That variant verifies the listing account was closed on-chain before Supabase accepts `cancelled`.

For devnet, start the app with devnet env and use the explicit devnet flag:

```bash
E2E_BASE_URL=http://localhost:3013 npm run e2e:publish-smoke -- --send-devnet-tx --full-lifecycle
```

The devnet variant uses generated smoke wallets funded by the Solana CLI payer, creates a listing against the deployed devnet program, mints devnet test USDC for the buyer, saves shipment tracking through Supabase, and verifies the listing reaches `sold`.

## Required Setup

- App running on the same URL used by `E2E_BASE_URL`.
- Wallet extension installed in the browser.
- Seller wallet funded on the configured cluster.
- Buyer wallet funded on the configured cluster.
- Buyer has test USDC for the configured mint.
- `NEXT_PUBLIC_TREASURY_WALLET` is a real wallet public key.
- For localnet E2E, use `NEXT_PUBLIC_SOLANA_RPC_URL=http://127.0.0.1:8899` and `NEXT_PUBLIC_SOLANA_NETWORK=localnet`.
- For devnet E2E, the configured program ID must be deployed and the configured mint/treasury must exist on devnet.

## Manual Flow

1. Seller connects wallet and opens `/listing/create`.
   Expected: sell form unlocks, escrow math appears, and the network badge matches the wallet cluster.

2. Seller creates a listing.
   Fill title, description, event, category, condition, size, price, and carrier shipping method. Sign publish.
   Expected: transaction succeeds and the app navigates to the new listing detail page.

3. Buyer connects wallet and opens the listing.
   Expected: `Buy now` appears with escrow policy and dispute/timeout guidance.

4. Buyer purchases the listing.
   Review purchase, verify total deposit, and sign.
   Expected: listing moves to `In Escrow`.

5. Seller saves tracking.
   Return with seller wallet, add carrier and tracking number.
   Expected: tracking persists through the Supabase shipping API, survives refresh, and buyer can view shipment details.

6. Buyer confirms or cancels.
   Return with buyer wallet and choose one final path:
   - Confirm receipt: listing becomes `Sold`.
   - Cancel purchase: listing returns to `Available`.

## Current Limitation

This app does not yet include on-chain dispute arbitration. The UI exposes the policy and time windows, but any escalation beyond cancellation/confirmation remains off-chain for the MVP.
