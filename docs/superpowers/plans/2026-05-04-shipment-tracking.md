# Shipment Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an off-chain shipment tracking workflow so sellers can provide carrier/tracking details during escrow and buyers can review delivery context before confirming receipt.

**Architecture:** Keep shipment data off-chain in the existing Supabase `shipping` table and local browser fallback storage. Expose listing-scoped API routes that authorize writes with the existing wallet session cookie. Render seller controls and buyer tracking panels on the listing detail page without changing the Anchor program.

**Tech Stack:** Next.js App Router API routes, TypeScript, Supabase service-role client, localStorage fallback helpers, existing wallet session auth.

---

### Task 1: Shared Types And Client Helpers

**Files:**
- Modify: `app/lib/supabase.ts`
- Modify: `app/lib/api.ts`
- Modify: `app/lib/localListings.ts`

- [x] Add a `DbShipping` type matching the `shipping` table.
- [x] Add `fetchShipping` and `upsertShipping` API client helpers.
- [x] Add local fallback storage helpers for shipment records keyed by listing id.

### Task 2: Listing-Scoped Shipping API

**Files:**
- Create: `app/app/api/listings/[id]/shipping/route.ts`

- [x] Implement `GET /api/listings/[id]/shipping`.
- [x] Implement `POST /api/listings/[id]/shipping`.
- [x] Require seller wallet session for writes.
- [x] Allow writes only while the listing is `in_escrow`.
- [x] Upsert one shipping row per listing id.

### Task 3: Listing Detail UI

**Files:**
- Modify: `app/app/listing/[id]/page.tsx`
- Modify: `app/app/listing/[id]/page.module.css`

- [x] Load shipment info next to listing info.
- [x] Show seller tracking form for in-escrow owned listings.
- [x] Show buyer tracking panel for in-escrow purchases.
- [x] Keep confirmation copy clear: confirm receipt only after delivery.
- [x] Persist to Supabase API first, then local fallback if unavailable.

### Task 4: Verification And Context Update

**Files:**
- Modify: `.superstack/build-context.md`

- [x] Run `npm run lint`.
- [x] Run `npm run test:auth`.
- [x] Run `npm run test:display`.
- [x] Run `npm run build`.
- [x] Update `.superstack/build-context.md` shipment milestone if verification passes.
