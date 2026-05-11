import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LOCALNET_CANCEL_LISTING_FLAG,
  LOCALNET_CANCEL_PURCHASE_FLAG,
  LOCALNET_FULL_LIFECYCLE_FLAG,
  LOCALNET_PUBLISH_SMOKE_SEND_FLAG,
  DEVNET_PUBLISH_SMOKE_SEND_FLAG,
  buildSmokeShipment,
  buildListingMetadata,
  createMetadataHash,
  getCookieHeader,
  getLocalnetPublishSmokeIssues,
  getLocalnetPublishSmokeMode,
  getSmokeSolFundingLamports,
} from '../lib/publishSmoke.ts';

const localnetEnv = {
  NEXT_PUBLIC_SOLANA_RPC_URL: 'http://127.0.0.1:8899',
  NEXT_PUBLIC_SOLANA_NETWORK: 'localnet',
  NEXT_PUBLIC_PROGRAM_ID: 'BWM5Sppg3Qu2mZCGM9ZiwWxDe9st3y4x3rb4Yur7Hauj',
  NEXT_PUBLIC_USDC_MINT: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
};

const devnetEnv = {
  ...localnetEnv,
  NEXT_PUBLIC_SOLANA_RPC_URL: 'https://api.devnet.solana.com',
  NEXT_PUBLIC_SOLANA_NETWORK: 'devnet',
};

test('localnet publish smoke refuses to send without the explicit localnet flag', () => {
  const issues = getLocalnetPublishSmokeIssues({
    env: localnetEnv,
    argv: [],
  });

  assert.equal(issues.length, 1);
  assert.match(issues[0], new RegExp(LOCALNET_PUBLISH_SMOKE_SEND_FLAG));
});

test('localnet publish smoke rejects non-localnet environments', () => {
  const issues = getLocalnetPublishSmokeIssues({
    env: {
      ...localnetEnv,
      NEXT_PUBLIC_SOLANA_NETWORK: 'devnet',
      NEXT_PUBLIC_SOLANA_RPC_URL: 'https://api.devnet.solana.com',
    },
    argv: [LOCALNET_PUBLISH_SMOKE_SEND_FLAG],
  });

  assert.ok(issues.some((issue) => /localnet/i.test(issue)));
});

test('publish smoke accepts devnet only with the explicit devnet send flag', () => {
  assert.deepEqual(
    getLocalnetPublishSmokeIssues({
      env: devnetEnv,
      argv: [DEVNET_PUBLISH_SMOKE_SEND_FLAG],
    }),
    []
  );

  const issues = getLocalnetPublishSmokeIssues({
    env: devnetEnv,
    argv: [LOCALNET_PUBLISH_SMOKE_SEND_FLAG],
  });
  assert.ok(issues.some((issue) => /localnet/i.test(issue)));
});

test('localnet publish smoke accepts a complete localnet send configuration', () => {
  assert.deepEqual(
    getLocalnetPublishSmokeIssues({
      env: localnetEnv,
      argv: [LOCALNET_PUBLISH_SMOKE_SEND_FLAG],
    }),
    []
  );
});

test('localnet publish smoke resolves one final lifecycle mode', () => {
  assert.equal(getLocalnetPublishSmokeMode([]), 'publish');
  assert.equal(getLocalnetPublishSmokeMode([LOCALNET_FULL_LIFECYCLE_FLAG]), 'confirmReceipt');
  assert.equal(getLocalnetPublishSmokeMode([LOCALNET_CANCEL_PURCHASE_FLAG]), 'cancelPurchase');
  assert.equal(getLocalnetPublishSmokeMode([LOCALNET_CANCEL_LISTING_FLAG]), 'cancelListing');
});

test('localnet publish smoke rejects conflicting lifecycle modes', () => {
  const issues = getLocalnetPublishSmokeIssues({
    env: localnetEnv,
    argv: [
      LOCALNET_PUBLISH_SMOKE_SEND_FLAG,
      LOCALNET_FULL_LIFECYCLE_FLAG,
      LOCALNET_CANCEL_PURCHASE_FLAG,
    ],
  });

  assert.ok(issues.some((issue) => /Choose only one/i.test(issue)));
});

test('listing metadata hash matches the browser publish payload shape', async () => {
  const metadata = buildListingMetadata({
    title: 'Smoke listing',
    description: 'Automated smoke item',
    eventName: 'Breakpoint 2025',
    category: 'Cap',
    condition: 'New',
    size: 'One Size',
    shippingMethod: {
      id: 'dhl-servicepoint',
      carrier: 'DHL',
      service: 'ServicePoint parcel',
    },
    images: [],
  });

  const first = await createMetadataHash(metadata);
  const second = await createMetadataHash(metadata);

  assert.equal(metadata, '{"title":"Smoke listing","description":"Automated smoke item","eventName":"Breakpoint 2025","category":"Cap","condition":"New","size":"One Size","shippingMethod":{"id":"dhl-servicepoint","carrier":"DHL","service":"ServicePoint parcel"},"images":[]}');
  assert.match(first.hex, /^[0-9a-f]{64}$/);
  assert.deepEqual(first.bytes, second.bytes);
  assert.equal(first.hex, second.hex);
});

test('full lifecycle smoke uses deterministic shipment tracking payload', () => {
  assert.deepEqual(buildSmokeShipment(), {
    carrier: 'DPD',
    tracking_number: 'LOCALNET-SMOKE-11111',
    shipped_at: null,
    delivered_at: null,
  });
});

test('devnet smoke funding is smaller than localnet funding', () => {
  assert.equal(getSmokeSolFundingLamports('http://127.0.0.1:8899'), 1_000_000_000);
  assert.equal(getSmokeSolFundingLamports('https://api.devnet.solana.com'), 50_000_000);
});

test('combines response Set-Cookie headers into a request Cookie header', () => {
  assert.equal(
    getCookieHeader([
      'merchplace_nonce=abc; Path=/; HttpOnly',
      'merchplace_session=xyz; Path=/; HttpOnly; Secure',
    ]),
    'merchplace_nonce=abc; merchplace_session=xyz'
  );
});
