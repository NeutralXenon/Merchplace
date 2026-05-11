# Agentic Engineering Grant Application - Merchplace

Grant link: https://superteam.fun/earn/grants/agentic-engineering

## Upload Files

- `codex-session.jsonl` - relevant Codex proof transcript for Merchplace.
- `docs/submissions/video/merchplace-demo-video.m4v` - 3-minute product demo video.
- `docs/submissions/video/merchplace-demo-thumbnail.png` - demo thumbnail.
- Colosseum Copilot crowdedness score screenshot - still needs to be generated/uploaded.

Note: `claude-session.jsonl` was exported by the bundled script, but it appears to point at an unrelated Claude workspace. Use `codex-session.jsonl` for this application unless you also have a relevant Claude transcript.

## Step 1: Basics

**Project Title**
> Merchplace

**One Line Description**
> A Solana event merch marketplace with wallet-signed USDC escrow, carrier-priced shipping, and buyer-controlled receipt release.

**TG username**
> TODO: add your Telegram username, formatted as `t.me/<username>`.

**Wallet Address**
> TODO: add your Solana wallet address.

## Step 2: Details

**Project Details**
> Solana events create scarce physical artifacts: Breakpoint shirts, Colosseum winner gear, Superteam contributor drops, badges, caps, bags, stickers, and other event-specific merch. Today, most resale still happens through DMs, Discord trust, manual payment, and informal shipping coordination. That makes discovery poor, provenance hard to communicate, and buyer protection weak.
>
> Merchplace solves this with a Solana-native marketplace for event merch. Sellers create wallet-signed listings with item details, event context, images, condition, price, and a fixed carrier shipping method. Buyers see the full USDC total before signing: item price, shipping, and a 5% protection/platform fee. When they buy, USDC moves into a program-controlled escrow vault instead of going directly to the seller.
>
> The Anchor program handles listing creation, escrow funding, buyer cancellation, receipt confirmation, seller proceeds, and treasury fee release. Supabase stores rich off-chain listing metadata, images, shipping details, and listing events, while backend APIs verify confirmed on-chain state before accepting public listing or status updates. This keeps the marketplace usable like a normal consumer app while making custody and settlement verifiable on Solana.
>
> I used Codex/solana.new-style agentic engineering to rapidly move from idea to a working app: product positioning, Anchor escrow program, Next.js UI, wallet auth, Supabase persistence, image uploads, event drop pages, shipment tracking, devnet deployment, lifecycle smoke tests, mainnet readiness checks, brand/logo work, Legends submission assets, and a demo video. The grant would help me upscale this workflow into a production-ready launch loop: public hosted demo, real seller inventory, stronger monitoring, and repeatable agent-assisted development for future Solana products.

**Deadline (Europe/Amsterdam)**
> 2026-05-20

Recommended rationale: this gives roughly two weeks from May 6, 2026 to ship the public hosted demo, clean GitHub repo, production env hardening, and grant/Legends submission package.

**Proof of Work**
> - Built Merchplace, a custom Next.js + Anchor + Supabase Solana marketplace for event merch.
> - Anchor program supports `create_listing`, `buy_item`, `confirm_receipt`, `cancel_purchase`, and `cancel_listing`.
> - Devnet program deployed at `BWM5Sppg3Qu2mZCGM9ZiwWxDe9st3y4x3rb4Yur7Hauj`.
> - Devnet publish and full lifecycle smoke passed, including create, purchase, shipment tracking, receipt confirmation, Supabase sync, and final `sold` status.
> - Localnet generated-wallet smoke tests cover create, buy, confirm receipt, buyer cancellation, and seller cancellation.
> - Frontend includes browse, sell, listing detail, profile, wallet auth, transaction review, event drop pages, escrow guidance, dispute/timeout copy, and shipping/tracking UI.
> - Supabase schema, public listing image storage, listing events, and readiness checks are wired.
> - Mainnet readiness gate and production runbook exist, including `/api/health`.
> - Created brand system, artifact logo, Legends assets, X banner, product screenshots, and 3-minute demo video.
> - AI-assisted development transcript is attached as `codex-session.jsonl`.
> - GitHub profile: `github.com/NeutralXenon`.
> - X profile: `x.com/StarkIndustries`.
>
> Caveat: this workspace is currently not a git repository, so I could not include commit history or a remote URL from `git remote -v`. Before final submission, push the code to a public GitHub repo under `NeutralXenon` and add that URL here.

**Personal X Profile**
> x.com/StarkIndustries

**Personal Github Profile**
> github.com/NeutralXenon

**Colosseum Crowdedness Score**
> TODO: visit https://colosseum.com/copilot, search/analyze Merchplace, take a screenshot of the crowdedness score, upload it to Google Drive, and paste the public Drive link here.

**AI Session Transcript**
> Upload `codex-session.jsonl` from the project root. It contains the relevant Codex session for Merchplace.

## Step 3: Milestones

**Goals and Milestones**
> 1. By 2026-05-09: Push the full Merchplace codebase to a public GitHub repository, add a project README, and include setup instructions for Anchor, Next.js, Supabase, and devnet smoke tests.
> 2. By 2026-05-12: Deploy a public hosted devnet demo with the current devnet program ID, Supabase backend, image upload, event drop pages, and `/api/health` monitoring.
> 3. By 2026-05-15: Seed realistic Breakpoint/Colosseum demo inventory, record a clean wallet walkthrough, and publish the demo video plus Legends/Superteam submission assets.
> 4. By 2026-05-18: Harden production readiness: project-owned treasury, production auth secret, paid RPC configuration, monitoring checklist, and documented failed-sync recovery flow.
> 5. By 2026-05-20: Submit the Colosseum/Legends project page, public GitHub repo, grant proof files, and final demo package.

**Primary KPI**
> 10 wallet-authenticated users create or interact with at least 20 event merch listings on devnet, with at least 5 completed escrow lifecycle transactions.

**Final Tranche Checklist**
> To receive the final tranche, prepare the Colosseum project link, public GitHub repo, and AI subscription receipt. Also keep the `codex-session.jsonl` transcript and Colosseum crowdedness score screenshot available in the Drive folder.

## Missing Before Submit

- Telegram username.
- Solana wallet address.
- Public GitHub repo URL for the Merchplace codebase.
- Public hosted demo URL.
- Colosseum Copilot crowdedness score screenshot.
- Public Google Drive folder containing `codex-session.jsonl`, demo video, screenshots, and any receipts required by the grant.
