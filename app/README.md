# Merchplace

Merchplace is a Solana event merch marketplace with wallet-signed USDC escrow, buyer protection, carrier-priced shipping, and receipt-based settlement.

The app is built for limited Solana event artifacts: Breakpoint shirts, Colosseum gear, Superteam contributor drops, badges, caps, bags, and other collector inventory. Sellers publish wallet-signed listings, buyers deposit USDC into an Anchor escrow program, sellers add tracking, and funds release when the buyer confirms receipt.

## Status

- Devnet program: `BWM5Sppg3Qu2mZCGM9ZiwWxDe9st3y4x3rb4Yur7Hauj`
- Devnet smoke: full generated-wallet lifecycle passed, including create listing, buy, tracking, receipt confirmation, Supabase sync, and final `sold` status.
- Mainnet: not deployed. Production mainnet is intentionally blocked until production RPC, mainnet USDC mint, project treasury, and production `AUTH_SECRET` are configured.

## Stack

- Next.js App Router frontend
- Anchor Solana program
- Supabase metadata, image storage, listing events, and shipping/tracking persistence
- Wallet message auth with session tokens
- USDC escrow vault controlled by the Solana program

## Local App Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

For a complete localnet wallet demo, run these from this `app/` directory after the Anchor program is built:

```bash
npm run localnet:e2e-setup
npm run dev
E2E_BASE_URL=http://localhost:3000 npm run e2e:readiness -- --strict
```

## Verification Commands

```bash
npm run lint
npm run build
npm run test:auth
npm run test:display
npm run test:listing-verification
npm run test:status-sync
npm run test:publish-smoke
```

Devnet lifecycle smoke:

```bash
E2E_BASE_URL=http://localhost:3000 npm run e2e:publish-smoke -- --send-devnet-tx --full-lifecycle
```

Mainnet readiness gate:

```bash
npm run mainnet:check
```

`mainnet:check` is expected to fail until real production values are supplied.

## Submission Assets

Hackathon submission materials live in `../docs/submissions/`.

- Copy-paste submission draft: `../docs/submissions/legends-fun-submission.html`
- Demo video exports: `../docs/submissions/video/`
- Mainnet production handoff: `../docs/mainnet-runbook.md`
