# Event Supply Proof Implementation Plan

**Goal:** Make the first event drop feel like a credible launch wedge instead of a generic demo shelf.

**Architecture:** Extend the event catalog with supply targets, wanted inventory, seller slots, and curation standards. Seed Breakpoint 2025 with varied fallback listings and render a supply proof module on event drop pages.

**Tech Stack:** Next.js App Router, React client components, CSS modules, local fallback listing data, node:test.

---

### Task 1: Supply Model And Tests

**Files:**
- Modify: `app/lib/events.ts`
- Create: `app/scripts/eventSupply.test.mjs`

- [x] Add launch status, supply goal, wanted inventory, seller slots, and curation standard fields.
- [x] Add supply readiness helper.
- [x] Test launch drop configuration, fallback inventory variety, and readiness math.

### Task 2: Launch Drop Seed Inventory

**Files:**
- Modify: `app/lib/localListings.ts`

- [x] Add varied Breakpoint 2025 fallback listings across apparel, badges, stickers, bags, and caps.
- [x] Keep statuses varied so available, escrow, and sold inventory states are visible.

### Task 3: Event Page Proof UI

**Files:**
- Modify: `app/app/event/[slug]/page.tsx`
- Modify: `app/app/event/[slug]/page.module.css`

- [x] Render inventory readiness against the event supply goal.
- [x] Show wanted inventory, seller slots, and curation standard.
- [x] Use local seed inventory for launch-drop pages when Supabase is reachable but empty.

### Task 4: Verification And Context

**Files:**
- Modify: `app/package.json`
- Modify: `.superstack/build-context.md`
- Modify: `.superstack/idea-context.md`

- [x] Add `npm run test:supply`.
- [x] Run supply, auth, display, trust, lint, and production build checks.
- [x] Record the supply-proof milestone in Superstack context.
