import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PublicKey } from '@solana/web3.js';
import {
  assertListingMatchesChain,
  assertListingTransitionMatchesChain,
  assertTransactionReferencesListing,
  deriveListingPda,
  getListingAccountCoderName,
  metadataBytesToHex,
  waitForSignatureConfirmed,
} from '../lib/listingVerification.ts';

const programId = new PublicKey('BWM5Sppg3Qu2mZCGM9ZiwWxDe9st3y4x3rb4Yur7Hauj');
const usdcMint = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
const seller = new PublicKey('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgA1x');
const buyer = new PublicKey('8WfNuLGfFco74uReSdLTpmZzcsZrHUiYxNebADGwXyE1');
const listingId = 1_772_000_000_000;
const listingPda = deriveListingPda({
  sellerWallet: seller.toBase58(),
  listingId,
  programId: programId.toBase58(),
});
const metadataHash = '01'.repeat(32);

function matchingSnapshot(overrides = {}) {
  return {
    listingPda,
    ownerProgram: programId.toBase58(),
    sellerWallet: seller.toBase58(),
    listingId,
    priceUsdc: 10_000_000,
    shippingCost: 4_290_000,
    metadataHash,
    status: 'available',
    usdcMint: usdcMint.toBase58(),
    buyerWallet: PublicKey.default.toBase58(),
    ...overrides,
  };
}

function matchingPayload(overrides = {}) {
  return {
    sellerWallet: seller.toBase58(),
    listingPda,
    listingId,
    priceUsdc: 10_000_000,
    shippingCost: 4_290_000,
    metadataHash,
    ...overrides,
  };
}

test('derives the expected listing PDA from seller and listing id', () => {
  assert.equal(
    deriveListingPda({
      sellerWallet: seller.toBase58(),
      listingId,
      programId: programId.toBase58(),
    }),
    listingPda
  );
});

test('uses the actual Anchor IDL account name when decoding listings', () => {
  assert.equal(getListingAccountCoderName(), 'Listing');
});

test('accepts an on-chain listing snapshot that matches the submitted listing', () => {
  assert.doesNotThrow(() =>
    assertListingMatchesChain({
      payload: matchingPayload(),
      snapshot: matchingSnapshot(),
      programId: programId.toBase58(),
      usdcMint: usdcMint.toBase58(),
    })
  );
});

test('accepts Anchor enum casing for available listings', () => {
  assert.doesNotThrow(() =>
    assertListingMatchesChain({
      payload: matchingPayload(),
      snapshot: matchingSnapshot({ status: 'Available' }),
      programId: programId.toBase58(),
      usdcMint: usdcMint.toBase58(),
    })
  );
});

test('rejects mismatched listing fields before Supabase insert', () => {
  assert.throws(
    () =>
      assertListingMatchesChain({
        payload: matchingPayload({ shippingCost: 2_890_000 }),
        snapshot: matchingSnapshot(),
        programId: programId.toBase58(),
        usdcMint: usdcMint.toBase58(),
      }),
    /shipping/i
  );

  assert.throws(
    () =>
      assertListingMatchesChain({
        payload: matchingPayload(),
        snapshot: matchingSnapshot({ status: 'in_escrow' }),
        programId: programId.toBase58(),
        usdcMint: usdcMint.toBase58(),
      }),
    /available/i
  );
});

test('normalizes metadata hash bytes to hex', () => {
  assert.equal(metadataBytesToHex(new Array(32).fill(15)), '0f'.repeat(32));
});

test('verifies purchase transition against on-chain buyer and status', () => {
  assert.doesNotThrow(() =>
    assertListingTransitionMatchesChain({
      payload: matchingPayload(),
      snapshot: matchingSnapshot({
        status: 'in_escrow',
        buyerWallet: buyer.toBase58(),
      }),
      programId: programId.toBase58(),
      usdcMint: usdcMint.toBase58(),
      transition: {
        fromStatus: 'available',
        toStatus: 'in_escrow',
        actorWallet: buyer.toBase58(),
        buyerWallet: buyer.toBase58(),
      },
    })
  );

  assert.throws(
    () =>
      assertListingTransitionMatchesChain({
        payload: matchingPayload(),
        snapshot: matchingSnapshot({
          status: 'in_escrow',
          buyerWallet: seller.toBase58(),
        }),
        programId: programId.toBase58(),
        usdcMint: usdcMint.toBase58(),
        transition: {
          fromStatus: 'available',
          toStatus: 'in_escrow',
          actorWallet: buyer.toBase58(),
          buyerWallet: buyer.toBase58(),
        },
      }),
    /buyer/i
  );
});

test('verifies receipt and cancellation transitions against on-chain status', () => {
  assert.doesNotThrow(() =>
    assertListingTransitionMatchesChain({
      payload: matchingPayload(),
      snapshot: matchingSnapshot({
        status: 'sold',
        buyerWallet: buyer.toBase58(),
      }),
      programId: programId.toBase58(),
      usdcMint: usdcMint.toBase58(),
      transition: {
        fromStatus: 'in_escrow',
        toStatus: 'sold',
        actorWallet: buyer.toBase58(),
        buyerWallet: buyer.toBase58(),
      },
    })
  );

  assert.doesNotThrow(() =>
    assertListingTransitionMatchesChain({
      payload: matchingPayload(),
      snapshot: matchingSnapshot({
        status: 'available',
        buyerWallet: PublicKey.default.toBase58(),
      }),
      programId: programId.toBase58(),
      usdcMint: usdcMint.toBase58(),
      transition: {
        fromStatus: 'in_escrow',
        toStatus: 'available',
        actorWallet: buyer.toBase58(),
        buyerWallet: null,
      },
    })
  );
});

test('verifies transition transactions reference the target listing account', () => {
  assert.doesNotThrow(() =>
    assertTransactionReferencesListing({
      txSignature: 'localnet-signature',
      listingPda,
      accountKeys: [buyer.toBase58(), listingPda, programId.toBase58()],
    })
  );

  assert.throws(
    () =>
      assertTransactionReferencesListing({
        txSignature: 'localnet-signature',
        listingPda,
        accountKeys: [buyer.toBase58(), programId.toBase58()],
      }),
    /listing/i
  );
});

test('retries transient missing transaction signatures before accepting confirmation', async () => {
  let calls = 0;
  const connection = {
    async getSignatureStatuses() {
      calls += 1;
      return {
        value: [
          calls < 3
            ? null
            : {
                err: null,
                confirmationStatus: 'confirmed',
              },
        ],
      };
    },
  };

  await waitForSignatureConfirmed(connection, 'devnet-signature', {
    attempts: 3,
    delayMs: 0,
  });

  assert.equal(calls, 3);
});

test('fails when a transaction signature is still missing after retries', async () => {
  let calls = 0;
  const connection = {
    async getSignatureStatuses() {
      calls += 1;
      return { value: [null] };
    },
  };

  await assert.rejects(
    () =>
      waitForSignatureConfirmed(connection, 'missing-signature', {
        attempts: 2,
        delayMs: 0,
      }),
    /not found/i
  );

  assert.equal(calls, 2);
});
