# Escrow Trust Layer Implementation Plan

**Goal:** Make the escrow promise concrete at the moment a buyer or seller decides what to sign.

**Architecture:** Keep escrow mechanics unchanged. Add reusable trust copy helpers, cover them with node tests, and render the same policy language in the listing checkout card and transaction review modal.

**Tech Stack:** Next.js App Router, React client components, CSS modules, existing transaction review modal, node:test.

---

### Task 1: Trust Copy Helper

**Files:**
- Create: `app/lib/escrowTrust.ts`
- Create: `app/scripts/escrowTrust.test.mjs`

- [x] Define escrow policy steps in reusable data.
- [x] Define role-specific notices for buyer, seller, and visitor states.
- [x] Define signing checklists for buy, confirm receipt, cancel purchase, and cancel listing.
- [x] Add focused tests for policy steps, role notices, and signing checklists.

### Task 2: Listing Detail Trust UI

**Files:**
- Modify: `app/app/listing/[id]/page.tsx`
- Modify: `app/app/listing/[id]/page.module.css`

- [x] Add escrow policy steps to the checkout area.
- [x] Add current role/status guidance for available, in-escrow, sold, and cancelled states.
- [x] Keep buyer confirmation copy strict when tracking is missing.

### Task 3: Signing Modal Checks

**Files:**
- Modify: `app/app/components/TransactionReviewModal.tsx`
- Modify: `app/app/components/TransactionReviewModal.module.css`

- [x] Add optional escrow checklist support.
- [x] Render action-specific checks before wallet approval.

### Task 4: Verification And Context

**Files:**
- Modify: `app/package.json`
- Modify: `.superstack/build-context.md`
- Modify: `.superstack/idea-context.md`

- [x] Add `npm run test:trust`.
- [x] Run focused trust tests, auth tests, display tests, lint, and production build.
- [x] Record the trust-layer milestone in Superstack context.
