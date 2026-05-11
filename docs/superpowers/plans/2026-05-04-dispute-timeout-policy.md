# Dispute And Timeout Policy Implementation Plan

**Goal:** Make the escrow failure path explicit so buyers and sellers understand what happens when shipping, delivery, or receipt confirmation breaks down.

**Architecture:** Keep on-chain mechanics unchanged. Add a reusable dispute policy helper with tests, show a status-specific "What happens next" panel on listing detail, and add policy-limit notes to transaction review modals before signing.

**Tech Stack:** Next.js App Router, React client components, CSS modules, existing transaction review modal, node:test.

---

### Task 1: Policy Helper And Tests

**Files:**
- Create: `app/lib/disputePolicy.ts`
- Create: `app/scripts/disputePolicy.test.mjs`

- [x] Define tracking and inspection windows.
- [x] State clearly that on-chain dispute arbitration does not exist yet.
- [x] Add role/status-specific guidance.
- [x] Add status-specific timeline steps.
- [x] Add transaction risk notes for purchase, receipt confirmation, cancellation, and listing cancellation.

### Task 2: Listing Detail Policy UI

**Files:**
- Modify: `app/app/listing/[id]/page.tsx`
- Modify: `app/app/listing/[id]/page.module.css`

- [x] Show a "What happens next" panel on listing detail.
- [x] Render policy guidance based on listing status, viewer role, and tracking state.
- [x] Show timeline steps and current product limitation.

### Task 3: Signing Modal Policy Notes

**Files:**
- Modify: `app/app/components/TransactionReviewModal.tsx`
- Modify: `app/app/components/TransactionReviewModal.module.css`

- [x] Add optional policy-limit/risk note rendering.
- [x] Surface irreversible release and cancellation consequences before wallet approval.

### Task 4: Verification And Context

**Files:**
- Modify: `app/package.json`
- Modify: `.superstack/build-context.md`
- Modify: `.superstack/idea-context.md`

- [x] Add `npm run test:policy`.
- [x] Run policy, auth, display, trust, supply, lint, and production build checks.
- [x] Record the dispute/timeout milestone in Superstack context.
