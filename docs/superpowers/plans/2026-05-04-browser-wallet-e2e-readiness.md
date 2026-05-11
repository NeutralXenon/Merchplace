# Browser Wallet E2E Readiness Plan

**Goal:** Prepare the app for an honest browser wallet E2E run without pretending wallet-extension signing can be automated from this environment.

**Architecture:** Add a tested readiness helper, a runnable diagnostic script, and a manual runbook. Keep the actual wallet signature path manual until a controllable wallet extension/test wallet harness is available.

**Tech Stack:** Next.js App Router, wallet-adapter frontend, node:test, local route checks with `fetch`.

---

### Task 1: Readiness Contract

**Files:**
- Create: `app/lib/e2eReadiness.ts`
- Create: `app/scripts/e2eReadiness.test.mjs`

- [x] Validate required public Solana environment values.
- [x] Block placeholder treasury wallet values.
- [x] Block invalid public keys.
- [x] Document the complete manual wallet lifecycle as testable data.

### Task 2: Diagnostic Script

**Files:**
- Create: `app/scripts/e2e-readiness.mjs`
- Modify: `app/package.json`

- [x] Add `npm run test:e2e-ready`.
- [x] Add `npm run e2e:readiness`.
- [x] Check core browser routes on the configured base URL.
- [x] Report listings API availability without failing local fallback smoke checks.
- [x] Support `--strict` for blocking readiness runs.

### Task 3: Manual Runbook

**Files:**
- Create: `docs/e2e/browser-wallet-e2e.md`

- [x] Document seller create listing flow.
- [x] Document buyer purchase flow.
- [x] Document seller tracking flow.
- [x] Document buyer confirm/cancel final state.
- [x] Call out the current lack of on-chain dispute arbitration.

### Task 4: Verification And Context

**Files:**
- Modify: `.superstack/build-context.md`
- Modify: `.superstack/idea-context.md`

- [x] Run E2E readiness tests and live diagnostic.
- [x] Run frontend lint, auth, display, policy, trust, supply, E2E readiness tests, and production build.
- [x] Record that browser wallet E2E remains pending until config/signing blockers are resolved.

### Task 5: Localnet Browser Wallet Setup

**Files:**
- Create: `app/scripts/localnet-e2e-setup.mjs`
- Modify: `app/package.json`
- Modify: `package.json`
- Modify: `docs/e2e/browser-wallet-e2e.md`
- Modify: `.superstack/build-context.md`
- Modify: `.superstack/idea-context.md`

- [x] Add a root command that starts `solana-test-validator` with the deployed merchplace program.
- [x] Add an app command that creates a local test USDC mint, rewrites public localnet env, and optionally funds seller/buyer wallet public keys.
- [x] Run the setup against a live local validator.
- [x] Rebuild and run strict readiness against the localnet app bundle.
- [x] Document the localnet path for the manual wallet signing flow.
