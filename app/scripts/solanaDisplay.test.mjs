import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSolscanAddressUrl,
  buildSolscanTxUrl,
  canOpenSolscan,
  formatUsdcMicro,
  getMarketplaceTotals,
  getSolanaCluster,
  truncateAddress,
} from '../lib/solanaDisplay.ts';

test('normalizes configured Solana clusters', () => {
  assert.equal(getSolanaCluster('mainnet-beta'), 'mainnet-beta');
  assert.equal(getSolanaCluster('https://api.mainnet-beta.solana.com'), 'mainnet-beta');
  assert.equal(getSolanaCluster('https://api.testnet.solana.com'), 'testnet');
  assert.equal(getSolanaCluster('http://127.0.0.1:8899'), 'localnet');
  assert.equal(getSolanaCluster(undefined), 'devnet');
});

test('builds Solscan URLs with the right cluster parameter', () => {
  assert.equal(
    buildSolscanTxUrl('abc123', 'devnet'),
    'https://solscan.io/tx/abc123?cluster=devnet'
  );
  assert.equal(
    buildSolscanAddressUrl('seller111', 'mainnet-beta'),
    'https://solscan.io/account/seller111'
  );
});

test('does not treat localnet transactions as externally viewable on Solscan', () => {
  assert.equal(canOpenSolscan('localnet'), false);
  assert.equal(canOpenSolscan('devnet'), true);
  assert.equal(canOpenSolscan('mainnet-beta'), true);
});

test('formats USDC micro-units and 5 percent marketplace totals', () => {
  assert.equal(formatUsdcMicro(45_000_000), '45.00');
  assert.deepEqual(getMarketplaceTotals(45_000_000, 5_000_000), {
    itemMicro: 45_000_000,
    shippingMicro: 5_000_000,
    buyerProtectionMicro: 2_250_000,
    buyerPaysMicro: 52_250_000,
    sellerReceivesMicro: 50_000_000,
  });
});

test('truncates public keys for marketplace UI', () => {
  assert.equal(
    truncateAddress('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgA1x'),
    '7xKX...gA1x'
  );
  assert.equal(truncateAddress('short'), 'short');
});
