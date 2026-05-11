import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ESCROW_POLICY_STEPS,
  getEscrowRoleNotice,
  getReviewChecklist,
} from '../lib/escrowTrust.ts';

test('describes escrow checkout as concrete buyer and seller steps', () => {
  assert.deepEqual(
    ESCROW_POLICY_STEPS.map((step) => step.title),
    [
      'Deposit held in escrow',
      'Seller ships with tracking',
      'Buyer releases after receipt',
    ]
  );

  assert.match(ESCROW_POLICY_STEPS[0].body, /total stays locked/i);
  assert.match(ESCROW_POLICY_STEPS[1].body, /tracking/i);
  assert.match(ESCROW_POLICY_STEPS[2].body, /seller/i);
});

test('returns role-specific in-escrow notices', () => {
  const buyerNotice = getEscrowRoleNotice('in_escrow', 'buyer', false);
  assert.equal(buyerNotice.title, 'Wait for the package');
  assert.match(buyerNotice.body, /tracking/i);
  assert.equal(buyerNotice.action, 'Confirm only after delivery');

  const sellerNotice = getEscrowRoleNotice('in_escrow', 'seller', false);
  assert.equal(sellerNotice.title, 'Ship and prove it');
  assert.equal(sellerNotice.action, 'Add tracking once shipped');
});

test('returns buyer-specific completed receipt copy', () => {
  const buyerNotice = getEscrowRoleNotice('sold', 'buyer', true);
  assert.equal(buyerNotice.title, 'Receipt confirmed');
  assert.equal(buyerNotice.action, 'Purchase complete');

  const sellerNotice = getEscrowRoleNotice('sold', 'seller', true);
  assert.equal(sellerNotice.title, 'Item sold');
  assert.equal(sellerNotice.action, 'Sale complete');
});

test('builds high-stakes signing checklists', () => {
  assert.deepEqual(getReviewChecklist('buy', true), [
    'Deposit goes into Merchplace escrow, not directly to the seller.',
    'Seller must ship and share tracking before release.',
    'Buyer confirms receipt to release seller funds.',
  ]);

  assert.ok(
    getReviewChecklist('confirm', false).some((item) => item.includes('No tracking is saved'))
  );
  assert.ok(
    getReviewChecklist('cancelPurchase', true).some((item) => item.includes('Refund returns'))
  );
});
