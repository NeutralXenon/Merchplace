import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DISPUTE_POLICY,
  getDisputeGuidance,
  getDisputeTimeline,
  getReviewRiskNotes,
} from '../lib/disputePolicy.ts';

test('defines concrete timeout windows without claiming arbitration', () => {
  assert.equal(DISPUTE_POLICY.trackingWindowDays, 3);
  assert.equal(DISPUTE_POLICY.inspectionWindowDays, 7);
  assert.match(DISPUTE_POLICY.limitation, /No on-chain dispute arbitration/i);
});

test('returns buyer guidance when escrow has no tracking', () => {
  const guidance = getDisputeGuidance('in_escrow', 'buyer', false);

  assert.equal(guidance.title, 'Tracking is the next proof point');
  assert.equal(guidance.tone, 'warning');
  assert.match(guidance.body, /3 days/i);
  assert.match(guidance.body, /cancel/i);
});

test('returns seller guidance after tracking is saved', () => {
  const guidance = getDisputeGuidance('in_escrow', 'seller', true);

  assert.equal(guidance.title, 'Buyer is in the inspection window');
  assert.equal(guidance.tone, 'info');
  assert.match(guidance.body, /7 days/i);
  assert.match(guidance.action, /Keep proof/i);
});

test('builds status-specific timeline steps', () => {
  const available = getDisputeTimeline('available', false);
  assert.equal(available[0].title, 'Purchase opens escrow');

  const inEscrowWithoutTracking = getDisputeTimeline('in_escrow', false);
  assert.ok(inEscrowWithoutTracking.some((step) => step.title === 'Seller adds tracking'));
  assert.ok(inEscrowWithoutTracking.some((step) => step.body.includes('3 days')));

  const sold = getDisputeTimeline('sold', true);
  assert.equal(sold.at(-1).title, 'Trade complete');
});

test('adds sharp risk notes to irreversible signing actions', () => {
  assert.ok(
    getReviewRiskNotes('confirm', false).some((note) => note.includes('permanently releases'))
  );
  assert.ok(
    getReviewRiskNotes('confirm', false).some((note) => note.includes('No tracking is saved'))
  );
  assert.ok(
    getReviewRiskNotes('cancelPurchase', true).some((note) => note.includes('returns escrow'))
  );
});
