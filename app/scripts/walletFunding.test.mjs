import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isLocalSolanaEndpoint,
  isNoPriorCreditError,
  getWalletFundingErrorMessage,
  ensureWalletHasFeeLamports,
} from '../lib/walletFunding.ts';

test('recognizes local validator endpoints that can self-fund wallets', () => {
  assert.equal(isLocalSolanaEndpoint('http://127.0.0.1:8899'), true);
  assert.equal(isLocalSolanaEndpoint('http://localhost:8899'), true);
  assert.equal(isLocalSolanaEndpoint('https://api.devnet.solana.com'), false);
});

test('recognizes Solana no prior credit simulation errors', () => {
  assert.equal(
    isNoPriorCreditError(
      new Error('Transaction simulation failed: Attempt to debit an account but found no record of a prior credit.')
    ),
    true
  );
  assert.equal(isNoPriorCreditError(new Error('user rejected transaction')), false);
});

test('explains missing fee payer SOL with a localnet-specific message', () => {
  assert.match(
    getWalletFundingErrorMessage('localnet'),
    /no SOL on localnet/i
  );
  assert.match(
    getWalletFundingErrorMessage('devnet'),
    /needs SOL/i
  );
});

test('airdrops SOL on localnet when the wallet cannot pay transaction fees', async () => {
  const calls = [];
  const connection = {
    rpcEndpoint: 'http://127.0.0.1:8899',
    getBalance: async () => 0,
    requestAirdrop: async (_wallet, lamports) => {
      calls.push(['airdrop', lamports]);
      return 'airdrop-signature';
    },
    confirmTransaction: async (signature, commitment) => {
      calls.push(['confirm', signature, commitment]);
      return { value: { err: null } };
    },
  };

  const result = await ensureWalletHasFeeLamports(connection, {
    toBase58: () => 'SellerWallet111111111111111111111111111111',
  });

  assert.equal(result.airdropped, true);
  assert.deepEqual(calls, [
    ['airdrop', 2_000_000_000],
    ['confirm', 'airdrop-signature', 'confirmed'],
  ]);
});

test('does not airdrop when the wallet already has enough SOL', async () => {
  const connection = {
    rpcEndpoint: 'http://127.0.0.1:8899',
    getBalance: async () => 100_000_000,
    requestAirdrop: async () => {
      throw new Error('should not airdrop');
    },
  };

  const result = await ensureWalletHasFeeLamports(connection, {
    toBase58: () => 'SellerWallet111111111111111111111111111111',
  });

  assert.equal(result.airdropped, false);
});
