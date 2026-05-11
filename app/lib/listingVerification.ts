import * as anchor from '@coral-xyz/anchor';
import type { Idl } from '@coral-xyz/anchor';
import { createRequire } from 'node:module';
import { clusterApiUrl, Connection, PublicKey } from '@solana/web3.js';

const DEFAULT_PROGRAM_ID = 'BWM5Sppg3Qu2mZCGM9ZiwWxDe9st3y4x3rb4Yur7Hauj';
const DEFAULT_USDC_MINT = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const require = createRequire(import.meta.url);
const idlJson = require('./idl/merchplace.json') as Idl;
const { BorshAccountsCoder } = anchor;

export type ListingVerificationPayload = {
  sellerWallet: string;
  listingPda: string;
  listingId: number;
  priceUsdc: number;
  shippingCost: number;
  metadataHash: string;
};

export type ListingChainSnapshot = ListingVerificationPayload & {
  ownerProgram: string;
  status: string;
  usdcMint: string;
  buyerWallet: string;
};

export type ListingStatusValue = 'available' | 'in_escrow' | 'sold' | 'cancelled';

export type ListingTransition = {
  fromStatus: ListingStatusValue;
  toStatus: ListingStatusValue;
  actorWallet: string;
  buyerWallet?: string | null;
};

type DecodedListingAccount = {
  seller?: PublicKey;
  buyer?: PublicKey;
  price?: AnchorNumber;
  shippingCost?: AnchorNumber;
  shipping_cost?: AnchorNumber;
  metadataHash?: number[] | Uint8Array;
  metadata_hash?: number[] | Uint8Array;
  listingId?: AnchorNumber;
  listing_id?: AnchorNumber;
  status?: unknown;
  usdcMint?: PublicKey;
  usdc_mint?: PublicKey;
};

type AnchorNumber = number | { toNumber(): number };
type ChainLookupRetryOptions = {
  attempts: number;
  delayMs: number;
};
type SignatureStatusConnection = Pick<Connection, 'getSignatureStatuses'>;
type TransactionLookupConnection = Pick<Connection, 'getTransaction'>;
type AccountLookupConnection = Pick<Connection, 'getAccountInfo'>;

const DEFAULT_CHAIN_LOOKUP_ATTEMPTS = 8;
const DEFAULT_CHAIN_LOOKUP_DELAY_MS = 1500;

export class ListingVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ListingVerificationError';
  }
}

function readPublicKey(label: string, value: string): PublicKey {
  try {
    return new PublicKey(value);
  } catch {
    throw new ListingVerificationError(`${label} is not a valid Solana public key`);
  }
}

function readU64(label: string, value: number): bigint {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ListingVerificationError(`${label} must be a non-negative safe integer`);
  }

  return BigInt(value);
}

function bnToNumber(label: string, value: AnchorNumber | undefined): number {
  if (value === undefined) {
    throw new ListingVerificationError(`On-chain listing is missing ${label}`);
  }

  const asNumber = typeof value === 'number' ? value : value.toNumber();
  if (!Number.isSafeInteger(asNumber) || asNumber < 0) {
    throw new ListingVerificationError(`On-chain ${label} is outside the supported range`);
  }

  return asNumber;
}

function listingIdSeed(listingId: number): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(readU64('listing_id', listingId));
  return buffer;
}

export function metadataBytesToHex(bytes: Iterable<number>): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function normalizeMetadataHash(hash: string): string {
  const normalized = hash.toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new ListingVerificationError('metadata_hash must be a 32-byte hex string');
  }

  return normalized;
}

function normalizeStatus(status: unknown): string {
  let rawStatus = '';
  if (typeof status === 'string') rawStatus = status;
  if (status && typeof status === 'object') {
    const [key] = Object.keys(status);
    if (key) rawStatus = key;
  }

  const compact = rawStatus.replace(/[-_\s]/g, '').toLowerCase();
  if (compact === 'available') return 'available';
  if (compact === 'inescrow') return 'in_escrow';
  if (compact === 'completed' || compact === 'sold') return 'sold';
  if (compact === 'cancelled' || compact === 'canceled') return 'cancelled';

  return rawStatus || 'unknown';
}

function defaultWallet(): string {
  return PublicKey.default.toBase58();
}

export function getListingAccountCoderName(): string {
  const accountName = idlJson.accounts?.find(
    (account) => account.name.toLowerCase() === 'listing'
  )?.name;

  if (!accountName) {
    throw new ListingVerificationError('Listing account is missing from the Anchor IDL');
  }

  return accountName;
}

export function deriveListingPda({
  sellerWallet,
  listingId,
  programId,
}: {
  sellerWallet: string;
  listingId: number;
  programId: string;
}): string {
  const seller = readPublicKey('seller_wallet', sellerWallet);
  const program = readPublicKey('program_id', programId);
  const [listingPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('listing'), seller.toBuffer(), listingIdSeed(listingId)],
    program
  );

  return listingPda.toBase58();
}

export function assertListingMatchesChain({
  payload,
  snapshot,
  programId,
  usdcMint,
}: {
  payload: ListingVerificationPayload;
  snapshot: ListingChainSnapshot;
  programId: string;
  usdcMint: string;
}): void {
  assertListingCoreMatchesChain({ payload, snapshot, programId, usdcMint });

  if (normalizeStatus(snapshot.status) !== 'available') {
    throw new ListingVerificationError('On-chain listing must be available before it can go live');
  }
}

function assertListingCoreMatchesChain({
  payload,
  snapshot,
  programId,
  usdcMint,
}: {
  payload: ListingVerificationPayload;
  snapshot: ListingChainSnapshot;
  programId: string;
  usdcMint: string;
}): void {
  const expectedPda = deriveListingPda({
    sellerWallet: payload.sellerWallet,
    listingId: payload.listingId,
    programId,
  });

  const expectedMetadataHash = normalizeMetadataHash(payload.metadataHash);
  const actualMetadataHash = normalizeMetadataHash(snapshot.metadataHash);

  if (payload.listingPda !== expectedPda) {
    throw new ListingVerificationError('listing_pda does not match seller and listing_id');
  }

  if (snapshot.listingPda !== expectedPda) {
    throw new ListingVerificationError('On-chain listing PDA does not match seller and listing_id');
  }

  if (snapshot.ownerProgram !== programId) {
    throw new ListingVerificationError('On-chain listing is not owned by the merchplace program');
  }

  if (snapshot.sellerWallet !== payload.sellerWallet) {
    throw new ListingVerificationError('On-chain seller does not match submitted seller_wallet');
  }

  if (snapshot.listingId !== payload.listingId) {
    throw new ListingVerificationError('On-chain listing_id does not match submitted listing_id');
  }

  if (snapshot.priceUsdc !== payload.priceUsdc) {
    throw new ListingVerificationError('On-chain price does not match submitted price');
  }

  if (snapshot.shippingCost !== payload.shippingCost) {
    throw new ListingVerificationError('On-chain shipping does not match submitted shipping');
  }

  if (actualMetadataHash !== expectedMetadataHash) {
    throw new ListingVerificationError('On-chain metadata hash does not match submitted metadata');
  }

  if (snapshot.usdcMint !== usdcMint) {
    throw new ListingVerificationError('On-chain USDC mint does not match app configuration');
  }
}

export function assertListingTransitionMatchesChain({
  payload,
  snapshot,
  programId,
  usdcMint,
  transition,
}: {
  payload: ListingVerificationPayload;
  snapshot: ListingChainSnapshot;
  programId: string;
  usdcMint: string;
  transition: ListingTransition;
}): void {
  assertListingCoreMatchesChain({ payload, snapshot, programId, usdcMint });

  const onChainStatus = normalizeStatus(snapshot.status);
  if (onChainStatus !== transition.toStatus) {
    throw new ListingVerificationError('On-chain listing status does not match submitted status update');
  }

  const actorWallet = readPublicKey('actor_wallet', transition.actorWallet).toBase58();
  const buyerWallet = transition.buyerWallet
    ? readPublicKey('buyer_wallet', transition.buyerWallet).toBase58()
    : null;
  const onChainBuyer = snapshot.buyerWallet || defaultWallet();

  if (transition.fromStatus === 'available' && transition.toStatus === 'in_escrow') {
    if (!buyerWallet || buyerWallet !== actorWallet) {
      throw new ListingVerificationError('Purchase update buyer_wallet must match the signing buyer');
    }

    if (onChainBuyer !== actorWallet) {
      throw new ListingVerificationError('On-chain buyer does not match submitted buyer_wallet');
    }
    return;
  }

  if (transition.fromStatus === 'in_escrow' && transition.toStatus === 'sold') {
    if (!buyerWallet || buyerWallet !== actorWallet) {
      throw new ListingVerificationError('Receipt confirmation must be signed by the escrow buyer');
    }

    if (onChainBuyer !== actorWallet) {
      throw new ListingVerificationError('On-chain buyer does not match the confirming buyer');
    }
    return;
  }

  if (transition.fromStatus === 'in_escrow' && transition.toStatus === 'available') {
    if (buyerWallet !== null) {
      throw new ListingVerificationError('Purchase cancellation must clear buyer_wallet');
    }

    if (onChainBuyer !== defaultWallet()) {
      throw new ListingVerificationError('On-chain buyer must be cleared after purchase cancellation');
    }
    return;
  }

  throw new ListingVerificationError('Unsupported listing status transition');
}

export function assertTransactionReferencesListing({
  txSignature,
  listingPda,
  accountKeys,
}: {
  txSignature: string;
  listingPda: string;
  accountKeys: string[];
}): void {
  readPublicKey('listing_pda', listingPda);

  if (!accountKeys.includes(listingPda)) {
    throw new ListingVerificationError(
      `Transaction ${txSignature} does not reference the target listing account`
    );
  }
}

function getRpcUrl(): string {
  return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('devnet');
}

function getProgramId(): string {
  return process.env.NEXT_PUBLIC_PROGRAM_ID || DEFAULT_PROGRAM_ID;
}

function getUsdcMint(): string {
  return process.env.NEXT_PUBLIC_USDC_MINT || DEFAULT_USDC_MINT;
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;

  return parsed;
}

function getChainLookupRetryOptions(): ChainLookupRetryOptions {
  return {
    attempts: readPositiveInteger(
      process.env.CHAIN_VERIFICATION_RETRY_ATTEMPTS,
      DEFAULT_CHAIN_LOOKUP_ATTEMPTS
    ),
    delayMs: readPositiveInteger(
      process.env.CHAIN_VERIFICATION_RETRY_DELAY_MS,
      DEFAULT_CHAIN_LOOKUP_DELAY_MS
    ),
  };
}

async function waitForChainLookupRetry(delayMs: number): Promise<void> {
  if (delayMs <= 0) return;

  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function waitForSignatureConfirmed(
  connection: SignatureStatusConnection,
  txSignature: string,
  retryOptions: ChainLookupRetryOptions = getChainLookupRetryOptions()
): Promise<void> {
  let status: Awaited<ReturnType<Connection['getSignatureStatuses']>>['value'][number] = null;

  for (let attempt = 0; attempt < retryOptions.attempts; attempt += 1) {
    const statuses = await connection.getSignatureStatuses([txSignature], {
      searchTransactionHistory: true,
    });
    status = statuses.value[0];

    if (status || attempt === retryOptions.attempts - 1) break;
    await waitForChainLookupRetry(retryOptions.delayMs);
  }

  if (!status) {
    throw new ListingVerificationError('Transaction signature was not found on the configured cluster');
  }

  if (status.err) {
    throw new ListingVerificationError('Transaction failed on-chain');
  }

  if (status.confirmationStatus !== 'confirmed' && status.confirmationStatus !== 'finalized') {
    throw new ListingVerificationError('Transaction is not confirmed yet');
  }
}

async function fetchTransactionWithRetry(
  connection: TransactionLookupConnection,
  txSignature: string,
  retryOptions: ChainLookupRetryOptions = getChainLookupRetryOptions()
): Promise<Awaited<ReturnType<Connection['getTransaction']>>> {
  let transaction: Awaited<ReturnType<Connection['getTransaction']>> = null;

  for (let attempt = 0; attempt < retryOptions.attempts; attempt += 1) {
    transaction = await connection.getTransaction(txSignature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (transaction || attempt === retryOptions.attempts - 1) break;
    await waitForChainLookupRetry(retryOptions.delayMs);
  }

  return transaction;
}

async function fetchAccountInfoWithRetry(
  connection: AccountLookupConnection,
  address: PublicKey,
  retryOptions: ChainLookupRetryOptions = getChainLookupRetryOptions()
): Promise<Awaited<ReturnType<Connection['getAccountInfo']>>> {
  let account: Awaited<ReturnType<Connection['getAccountInfo']>> = null;

  for (let attempt = 0; attempt < retryOptions.attempts; attempt += 1) {
    account = await connection.getAccountInfo(address, 'confirmed');

    if (account || attempt === retryOptions.attempts - 1) break;
    await waitForChainLookupRetry(retryOptions.delayMs);
  }

  return account;
}

function getTransactionAccountKeys(transaction: Awaited<ReturnType<Connection['getTransaction']>>): string[] {
  if (!transaction) return [];

  const message = transaction.transaction.message;
  if ('getAccountKeys' in message && typeof message.getAccountKeys === 'function') {
    const accountKeys = message.getAccountKeys({
      accountKeysFromLookups: transaction.meta?.loadedAddresses,
    });

    return [
      ...accountKeys.staticAccountKeys,
      ...(accountKeys.accountKeysFromLookups?.writable ?? []),
      ...(accountKeys.accountKeysFromLookups?.readonly ?? []),
    ].map((key) => key.toBase58());
  }

  if ('accountKeys' in message) {
    return message.accountKeys.map((key) => key.toBase58());
  }

  return [];
}

async function assertTransactionConfirmedAndReferencesListing(
  connection: Connection,
  txSignature: string,
  listingPda: string
): Promise<void> {
  await waitForSignatureConfirmed(connection, txSignature);

  const transaction = await fetchTransactionWithRetry(connection, txSignature);
  if (!transaction) {
    throw new ListingVerificationError('Transaction details were not found on the configured cluster');
  }
  if (transaction.meta?.err) {
    throw new ListingVerificationError('Transaction failed on-chain');
  }

  assertTransactionReferencesListing({
    txSignature,
    listingPda,
    accountKeys: getTransactionAccountKeys(transaction),
  });
}

async function assertListingAccountClosed({
  connection,
  listingPda,
}: {
  connection: Connection;
  listingPda: string;
}): Promise<void> {
  const listing = readPublicKey('listing_pda', listingPda);
  const account = await connection.getAccountInfo(listing, 'confirmed');
  if (account) {
    throw new ListingVerificationError('On-chain listing account is still open after cancellation');
  }
}

function decodeListingAccount(data: Buffer | Uint8Array): DecodedListingAccount {
  const coder = new BorshAccountsCoder(idlJson);
  return coder.decode(getListingAccountCoderName(), Buffer.from(data)) as DecodedListingAccount;
}

export async function fetchListingChainSnapshot({
  connection,
  listingPda,
}: {
  connection: Connection;
  listingPda: string;
}): Promise<ListingChainSnapshot> {
  const listing = readPublicKey('listing_pda', listingPda);
  const account = await fetchAccountInfoWithRetry(connection, listing);
  if (!account) {
    throw new ListingVerificationError('Listing account was not found on-chain');
  }

  const decoded = decodeListingAccount(account.data);
  const metadataHash = decoded.metadataHash ?? decoded.metadata_hash;
  const usdcMint = decoded.usdcMint ?? decoded.usdc_mint;
  const listingId = bnToNumber('listing_id', decoded.listingId ?? decoded.listing_id);

  if (!decoded.seller) {
    throw new ListingVerificationError('On-chain listing is missing seller');
  }
  if (!metadataHash) {
    throw new ListingVerificationError('On-chain listing is missing metadata_hash');
  }
  if (!usdcMint) {
    throw new ListingVerificationError('On-chain listing is missing usdc_mint');
  }

  return {
    listingPda: listing.toBase58(),
    ownerProgram: account.owner.toBase58(),
    sellerWallet: decoded.seller.toBase58(),
    buyerWallet: decoded.buyer?.toBase58() ?? defaultWallet(),
    listingId,
    priceUsdc: bnToNumber('price', decoded.price),
    shippingCost: bnToNumber('shipping_cost', decoded.shippingCost ?? decoded.shipping_cost),
    metadataHash: metadataBytesToHex(metadataHash),
    status: normalizeStatus(decoded.status),
    usdcMint: usdcMint.toBase58(),
  };
}

export async function verifyListingTransitionOnChain({
  payload,
  txSignature,
  transition,
}: {
  payload: ListingVerificationPayload;
  txSignature: string;
  transition: ListingTransition;
}): Promise<ListingChainSnapshot | null> {
  if (!txSignature) {
    throw new ListingVerificationError('tx_signature is required for listing transition verification');
  }

  const connection = new Connection(getRpcUrl(), 'confirmed');
  await assertTransactionConfirmedAndReferencesListing(
    connection,
    txSignature,
    payload.listingPda
  );

  if (transition.fromStatus === 'available' && transition.toStatus === 'cancelled') {
    const actorWallet = readPublicKey('actor_wallet', transition.actorWallet).toBase58();
    if (actorWallet !== payload.sellerWallet) {
      throw new ListingVerificationError('Listing cancellation must be signed by the seller');
    }

    await assertListingAccountClosed({
      connection,
      listingPda: payload.listingPda,
    });
    return null;
  }

  const snapshot = await fetchListingChainSnapshot({
    connection,
    listingPda: payload.listingPda,
  });

  assertListingTransitionMatchesChain({
    payload,
    snapshot,
    programId: getProgramId(),
    usdcMint: getUsdcMint(),
    transition,
  });

  return snapshot;
}

export async function verifyPublishedListingOnChain({
  payload,
  txSignature,
}: {
  payload: ListingVerificationPayload;
  txSignature: string;
}): Promise<ListingChainSnapshot> {
  if (!txSignature) {
    throw new ListingVerificationError('tx_signature is required for listing verification');
  }

  const connection = new Connection(getRpcUrl(), 'confirmed');
  await waitForSignatureConfirmed(connection, txSignature);
  const snapshot = await fetchListingChainSnapshot({
    connection,
    listingPda: payload.listingPda,
  });

  assertListingMatchesChain({
    payload,
    snapshot,
    programId: getProgramId(),
    usdcMint: getUsdcMint(),
  });

  return snapshot;
}
