import fs from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const listingPage = new URL('../app/listing/[id]/page.tsx', import.meta.url);

test('seller tracking save does not claim durable success from local storage fallback', () => {
  const source = fs.readFileSync(listingPage, 'utf8');

  assert.doesNotMatch(source, /saveLocalShipping/);
  assert.match(source, /saveSellerShipment/);
});

test('saveSellerShipment verifies the seller wallet session before remote persistence', async () => {
  const { saveSellerShipment } = await import('../lib/shippingPersistence.ts');
  const calls = [];
  const publicKey = {
    toBase58() {
      return 'seller-wallet';
    },
  };
  const shipment = {
    carrier: 'DPD',
    tracking_number: '11111',
    shipped_at: '2026-05-04T16:00:00.000Z',
    delivered_at: null,
  };

  const saved = await saveSellerShipment({
    listingId: 'listing-id',
    publicKey,
    signMessage: async () => new Uint8Array(),
    shipment,
    ensureSession: async (wallet) => {
      calls.push(['session', wallet?.toBase58()]);
    },
    saveRemote: async (listingId, payload) => {
      calls.push(['remote', listingId, payload.tracking_number]);
      return {
        id: 'shipping-id',
        listing_id: listingId,
        created_at: '2026-05-04T16:00:00.000Z',
        ...payload,
      };
    },
  });

  assert.equal(saved.tracking_number, '11111');
  assert.deepEqual(calls, [
    ['session', 'seller-wallet'],
    ['remote', 'listing-id', '11111'],
  ]);
});

test('saveSellerShipment surfaces remote persistence failures', async () => {
  const { saveSellerShipment } = await import('../lib/shippingPersistence.ts');

  await assert.rejects(
    saveSellerShipment({
      listingId: 'listing-id',
      publicKey: {
        toBase58() {
          return 'seller-wallet';
        },
      },
      signMessage: async () => new Uint8Array(),
      shipment: {
        carrier: 'DPD',
        tracking_number: '11111',
        shipped_at: '2026-05-04T16:00:00.000Z',
        delivered_at: null,
      },
      ensureSession: async () => {},
      saveRemote: async () => {
        throw new Error('Wallet session required');
      },
    }),
    /Wallet session required/
  );
});
