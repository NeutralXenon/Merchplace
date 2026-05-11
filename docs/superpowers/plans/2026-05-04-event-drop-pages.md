# Event Drop Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add shareable event-specific marketplace pages so Merchplace has concrete distribution units like `/event/breakpoint-2025`.

**Architecture:** Define a small curated event catalog in the frontend app, reuse existing listings APIs/fallback data filtered by event name, and render a client-side dynamic App Router page for each event slug. Link existing event labels and browse controls to the drop pages.

**Tech Stack:** Next.js App Router, React client components, CSS modules, existing `ListingCard`, existing `fetchListings`/`getFallbackListings` data flow.

---

### Task 1: Event Catalog

**Files:**
- Create: `app/lib/events.ts`

- [x] Define known event drops with slug, name, short copy, location, year, and theme.
- [x] Export helpers for lookup by slug/name and URL creation.

### Task 2: Event Drop Page

**Files:**
- Create: `app/app/event/[slug]/page.tsx`
- Create: `app/app/event/[slug]/page.module.css`

- [x] Load event metadata from slug.
- [x] Fetch listings filtered by event name with local fallback.
- [x] Show stats for total, available, in escrow, sold, and cancelled.
- [x] Render listing cards, loading skeletons, error fallback, and seller empty state.

### Task 3: Browse And Card Links

**Files:**
- Modify: `app/app/components/BrowseSection.tsx`
- Modify: `app/app/components/BrowseSection.module.css`
- Modify: `app/app/components/ListingCard.tsx`
- Modify: `app/app/components/ListingCard.module.css`

- [x] Use the event catalog for filter options.
- [x] Add event quick links in browse.
- [x] Link card event labels to their event pages without breaking the card link.

### Task 4: Verification And Context

**Files:**
- Modify: `.superstack/build-context.md`
- Modify: `.superstack/idea-context.md`

- [x] Run frontend lint, auth tests, display tests, and production build.
- [x] Run Anchor localnet tests if frontend verification passes.
- [x] Mark event pages as complete in Superstack context.
