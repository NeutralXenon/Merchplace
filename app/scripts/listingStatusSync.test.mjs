import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getListingStatusSyncErrorMessage } from '../lib/listingStatusSync.ts';

test('status sync errors explain that the on-chain action already succeeded', () => {
  assert.equal(
    getListingStatusSyncErrorMessage('buy', new Error('verification delayed')),
    'On-chain purchase succeeded, but Supabase sync failed: verification delayed'
  );

  assert.equal(
    getListingStatusSyncErrorMessage('cancelListing', 'Account not found'),
    'On-chain listing cancellation succeeded, but Supabase sync failed: Account not found'
  );
});
