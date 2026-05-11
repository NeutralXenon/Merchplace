import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddress,
} from '../lib/splTokenCompat.ts';

const mint = new PublicKey('EPjFWdd5AufqSSqeM2qfM5mQGgVYx3fFXkNC4BJKsQm');
const owner = new PublicKey('8WfNuLGfFco74uReSdLTpmZzcsZrHUiYxNebADGwXyE1');
const payer = new PublicKey('D646AGWpdriTQZ1Ltnk4KyjMuwjSoe7219uy76nt8nGz');

test('derives the standard associated token account address', async () => {
  const address = await getAssociatedTokenAddress(mint, owner);

  assert.equal(address.toBase58(), '37Zk7EnSKjxBs3tSWbZpuaPotqQAtrzxa6ijoXaxHTkf');
});

test('builds the idempotent associated token account instruction shape', async () => {
  const associatedToken = await getAssociatedTokenAddress(mint, owner);
  const instruction = createAssociatedTokenAccountIdempotentInstruction(
    payer,
    associatedToken,
    owner,
    mint
  );

  assert.equal(instruction.programId.toBase58(), ASSOCIATED_TOKEN_PROGRAM_ID.toBase58());
  assert.deepEqual([...instruction.data], [1]);
  assert.deepEqual(
    instruction.keys.map((key) => ({
      pubkey: key.pubkey.toBase58(),
      isSigner: key.isSigner,
      isWritable: key.isWritable,
    })),
    [
      { pubkey: payer.toBase58(), isSigner: true, isWritable: true },
      { pubkey: associatedToken.toBase58(), isSigner: false, isWritable: true },
      { pubkey: owner.toBase58(), isSigner: false, isWritable: false },
      { pubkey: mint.toBase58(), isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId.toBase58(), isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID.toBase58(), isSigner: false, isWritable: false },
    ]
  );
});
