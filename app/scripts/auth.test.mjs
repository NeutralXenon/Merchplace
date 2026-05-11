import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Keypair } from '@solana/web3.js';
import { ed25519 } from '@noble/curves/ed25519';
import {
  buildFallbackAuthUser,
  createAuthMessage,
  signSessionToken,
  verifySessionToken,
  verifyWalletSignature,
} from '../lib/auth.ts';

const encoder = new TextEncoder();

test('verifies a Solana wallet signature for an auth message', async () => {
  const wallet = Keypair.generate();
  const message = createAuthMessage({
    domain: 'localhost:3001',
    uri: 'http://localhost:3001',
    walletAddress: wallet.publicKey.toBase58(),
    nonce: 'nonce-123',
    issuedAt: '2026-05-01T10:00:00.000Z',
    cluster: 'devnet',
  });
  const signature = ed25519.sign(encoder.encode(message), wallet.secretKey.slice(0, 32));

  assert.equal(
    await verifyWalletSignature({
      walletAddress: wallet.publicKey.toBase58(),
      message,
      signatureBase64: Buffer.from(signature).toString('base64'),
    }),
    true
  );

  assert.equal(
    await verifyWalletSignature({
      walletAddress: wallet.publicKey.toBase58(),
      message: `${message}\nmodified`,
      signatureBase64: Buffer.from(signature).toString('base64'),
    }),
    false
  );
});

test('signs and verifies short lived wallet session tokens', () => {
  const now = Date.parse('2026-05-01T10:00:00.000Z');
  const token = signSessionToken({
    walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgA1x',
    secret: 'test-secret',
    nowMs: now,
  });

  assert.deepEqual(verifySessionToken(token, 'test-secret', now + 1000), {
    walletAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgA1x',
  });
  assert.equal(verifySessionToken(`${token}x`, 'test-secret', now + 1000), null);
  assert.equal(verifySessionToken(token, 'wrong-secret', now + 1000), null);
});

test('builds a wallet auth fallback user when profile persistence is unavailable', () => {
  assert.deepEqual(buildFallbackAuthUser('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgA1x'), {
    wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgA1x',
    display_name: null,
  });
  assert.deepEqual(buildFallbackAuthUser('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgA1x', '  Ada  '), {
    wallet_address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgA1x',
    display_name: 'Ada',
  });
});
