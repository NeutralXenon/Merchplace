'use client';

import { useMemo } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, Program, BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
} from './splTokenCompat';
import idlJson from './idl/merchplace.json';
import type { Merchplace } from './idl/merchplace_types';

const DEFAULT_PROGRAM_ID = 'BWM5Sppg3Qu2mZCGM9ZiwWxDe9st3y4x3rb4Yur7Hauj';
const DEFAULT_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

function readPublicKey(value: string | undefined, fallback: string): PublicKey {
  try {
    return new PublicKey(value || fallback);
  } catch {
    return new PublicKey(fallback);
  }
}

function createUsdcAtaInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey
): TransactionInstruction {
  return createAssociatedTokenAccountIdempotentInstruction(
    payer,
    associatedToken,
    owner,
    USDC_MINT,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

// Program ID from the deployed program
const PROGRAM_ID = readPublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID,
  DEFAULT_PROGRAM_ID
);

// USDC Mint (devnet) — configurable via env
const USDC_MINT = readPublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT,
  DEFAULT_USDC_MINT
);

// Platform treasury wallet — configurable via env
const TREASURY_WALLET = readPublicKey(
  process.env.NEXT_PUBLIC_TREASURY_WALLET,
  DEFAULT_PROGRAM_ID
);

/**
 * Hook to get the Merchplace Anchor program client.
 * Returns null if wallet is not connected.
 */
export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const program = useMemo(() => {
    if (!wallet) return null;

    const provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });

    return new Program(
      idlJson as unknown as Merchplace,
      provider
    ) as unknown as Program<Merchplace>;
  }, [connection, wallet]);

  return { program, connection, wallet, programId: PROGRAM_ID };
}

/**
 * Derive the listing PDA address.
 */
export function getListingPda(
  sellerPubkey: PublicKey,
  listingId: BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('listing'),
      sellerPubkey.toBuffer(),
      listingId.toArrayLike(Buffer, 'le', 8),
    ],
    PROGRAM_ID
  );
}

/**
 * Derive the escrow vault ATA (owned by the listing PDA).
 */
export async function getEscrowVault(listingPda: PublicKey): Promise<PublicKey> {
  return getAssociatedTokenAddress(USDC_MINT, listingPda, true);
}

/**
 * Create a listing on-chain.
 * We must explicitly pass all accounts since the listing PDA is being
 * created in this transaction and Anchor can't auto-resolve dependent accounts.
 */
export async function createListingOnChain(
  program: Program<Merchplace>,
  sellerPubkey: PublicKey,
  listingId: BN,
  price: BN,
  metadataHash: number[],
  shippingCost: BN
) {
  const [listingPda] = getListingPda(sellerPubkey, listingId);
  const escrowVault = await getEscrowVault(listingPda);
  const sellerTokenAccount = await getAssociatedTokenAddress(USDC_MINT, sellerPubkey);

  const tx = await (program.methods
    .createListing(listingId, price, metadataHash, shippingCost))
    .preInstructions([
      createUsdcAtaInstruction(sellerPubkey, sellerTokenAccount, sellerPubkey),
    ])
    .accountsStrict({
      seller: sellerPubkey,
      listing: listingPda,
      usdcMint: USDC_MINT,
      escrowVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { tx, listingPda: listingPda.toBase58() };
}

/**
 * Buy an item on-chain (deposit USDC into escrow).
 */
export async function buyItemOnChain(
  program: Program<Merchplace>,
  buyerPubkey: PublicKey,
  listingPda: PublicKey
) {
  const escrowVault = await getEscrowVault(listingPda);
  const buyerTokenAccount = await getAssociatedTokenAddress(USDC_MINT, buyerPubkey);

  const tx = await (program.methods
    .buyItem())
    .preInstructions([
      createUsdcAtaInstruction(buyerPubkey, buyerTokenAccount, buyerPubkey),
    ])
    .accountsStrict({
      buyer: buyerPubkey,
      listing: listingPda,
      usdcMint: USDC_MINT,
      buyerTokenAccount,
      escrowVault,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  return { tx };
}

/**
 * Confirm receipt on-chain (release escrow).
 */
export async function confirmReceiptOnChain(
  program: Program<Merchplace>,
  buyerPubkey: PublicKey,
  listingPda: PublicKey,
  sellerPubkey: PublicKey
) {
  const escrowVault = await getEscrowVault(listingPda);
  const sellerTokenAccount = await getAssociatedTokenAddress(USDC_MINT, sellerPubkey);
  const treasuryTokenAccount = await getAssociatedTokenAddress(
    USDC_MINT,
    TREASURY_WALLET,
    true
  );

  const tx = await (program.methods
    .confirmReceipt())
    .preInstructions([
      createUsdcAtaInstruction(buyerPubkey, sellerTokenAccount, sellerPubkey),
      createUsdcAtaInstruction(buyerPubkey, treasuryTokenAccount, TREASURY_WALLET),
    ])
    .accountsStrict({
      buyer: buyerPubkey,
      listing: listingPda,
      usdcMint: USDC_MINT,
      escrowVault,
      sellerTokenAccount,
      seller: sellerPubkey,
      treasuryTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  return { tx };
}

/**
 * Cancel a purchase on-chain (refund buyer).
 */
export async function cancelPurchaseOnChain(
  program: Program<Merchplace>,
  buyerPubkey: PublicKey,
  listingPda: PublicKey
) {
  const escrowVault = await getEscrowVault(listingPda);
  const buyerTokenAccount = await getAssociatedTokenAddress(USDC_MINT, buyerPubkey);

  const tx = await (program.methods
    .cancelPurchase())
    .preInstructions([
      createUsdcAtaInstruction(buyerPubkey, buyerTokenAccount, buyerPubkey),
    ])
    .accountsStrict({
      buyer: buyerPubkey,
      listing: listingPda,
      usdcMint: USDC_MINT,
      escrowVault,
      buyerTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();

  return { tx };
}

/**
 * Cancel a listing on-chain.
 */
export async function cancelListingOnChain(
  program: Program<Merchplace>,
  sellerPubkey: PublicKey,
  listingPda: PublicKey
) {
  const tx = await (program.methods
    .cancelListing())
    .accountsStrict({
      seller: sellerPubkey,
      listing: listingPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { tx };
}

export {
  PROGRAM_ID,
  USDC_MINT,
  TREASURY_WALLET,
  BN,
  PublicKey,
};
