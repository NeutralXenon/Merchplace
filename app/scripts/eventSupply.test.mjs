import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EVENT_DROPS,
  getEventDropBySlug,
  getSupplyReadiness,
} from '../lib/events.ts';
import { getFallbackListings } from '../lib/localListings.ts';

test('Breakpoint 2025 is configured as the launch drop with real supply targets', () => {
  const event = getEventDropBySlug('breakpoint-2025');
  assert.ok(event);
  assert.equal(event.launchStatus, 'launch-drop');
  assert.equal(event.supplyGoal, 12);
  assert.ok(event.wantedInventory.length >= 5);
  assert.ok(event.sellerSlots.length >= 3);
});

test('launch drop fallback inventory has enough variety to demo a real shelf', () => {
  const breakpointListings = getFallbackListings({ event: 'Breakpoint 2025', limit: 100 });
  const categories = new Set(breakpointListings.map((listing) => listing.category));
  const available = breakpointListings.filter((listing) => listing.status === 'available');

  assert.ok(breakpointListings.length >= 6);
  assert.ok(categories.size >= 4);
  assert.ok(available.length >= 4);
});

test('computes supply readiness from event goal and current inventory', () => {
  const event = EVENT_DROPS[0];
  const readiness = getSupplyReadiness(event, 6);

  assert.equal(readiness.goal, event.supplyGoal);
  assert.equal(readiness.current, 6);
  assert.equal(readiness.remaining, event.supplyGoal - 6);
  assert.equal(readiness.percent, 50);
});
