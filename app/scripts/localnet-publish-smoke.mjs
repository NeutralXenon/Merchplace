import anchor from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddress,
} from '../lib/splTokenCompat.ts';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import { ed25519 } from '@noble/curves/ed25519';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DEFAULT_SHIPPING_METHOD } from '../lib/shippingMethods.ts';
import {
  LOCALNET_FULL_LIFECYCLE_FLAG,
  LOCALNET_PUBLISH_SMOKE_SEND_FLAG,
  buildListingMetadata,
  buildSmokeShipment,
  createMetadataHash,
  getCookieHeader,
  getLocalnetPublishSmokeIssues,
  getLocalnetPublishSmokeMode,
  getSmokeSolFundingLamports,
} from '../lib/publishSmoke.ts';

const require = createRequire(import.meta.url);
const idlJson = require('../lib/idl/merchplace.json');

const DEFAULT_BASE_URL = 'http://localhost:3012';
function readDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;

      const separator = trimmed.indexOf('=');
      if (separator === -1) return acc;

      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '');
      acc[key] = value;
      return acc;
    }, {});
}

function getSetCookieHeaders(response) {
  if (typeof response.headers.getSetCookie === 'function') {
    return response.headers.getSetCookie();
  }

  const header = response.headers.get('set-cookie');
  return header ? header.split(/,(?=\s*[^;,]+=)/g).map((value) => value.trim()) : [];
}

function isLocalRpc(value) {
  const normalized = value?.toLowerCase() ?? '';
  return normalized.includes('127.0.0.1') || normalized.includes('localhost');
}

async function readJsonResponse(response) {
  return response.json().catch(() => ({}));
}

async function fetchRequiredJson(url, init, label) {
  const response = await fetch(url, init);
  const body = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}): ${body.error || response.statusText}`);
  }

  return { response, body };
}

async function confirmSignature(connection, signature, commitment = 'confirmed') {
  const latest = await connection.getLatestBlockhash(commitment);
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    commitment
  );
}

async function assertAccountExists(connection, address, label) {
  const account = await connection.getAccountInfo(address, 'confirmed');
  if (!account) {
    throw new Error(`${label} account was not found on localnet: ${address.toBase58()}`);
  }
}

function runLocalCli(command, args) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    env: { ...process.env, NO_DNA: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function getDefaultKeypairPath() {
  const output = runLocalCli('solana', ['config', 'get', 'keypair']);
  const match = output.match(/Key Path:\s*(.+)$/m);
  if (!match) {
    throw new Error('Unable to find Solana CLI keypair path for localnet token minting.');
  }

  return match[1].trim();
}

function readKeypairFile(filePath) {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(filePath, 'utf8')))
  );
}

function signAuthMessage(keypair, message) {
  const encoded = new TextEncoder().encode(message);
  const seed = keypair.secretKey.slice(0, 32);
  return Buffer.from(ed25519.sign(encoded, seed)).toString('base64');
}

async function createWalletSession({ baseUrl, keypair }) {
  const wallet = keypair.publicKey.toBase58();
  const nonce = await fetchRequiredJson(
    new URL('/api/auth/nonce', baseUrl),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: wallet }),
    },
    'Auth nonce'
  );

  const nonceCookie = getCookieHeader(getSetCookieHeaders(nonce.response));
  const signature = signAuthMessage(keypair, nonce.body.message);
  const verify = await fetchRequiredJson(
    new URL('/api/auth/verify', baseUrl),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: nonceCookie,
      },
      body: JSON.stringify({
        wallet_address: wallet,
        message: nonce.body.message,
        signature,
        display_name: 'Localnet Smoke Seller',
      }),
    },
    'Auth verify'
  );

  const sessionCookie = getCookieHeader(getSetCookieHeaders(verify.response));
  if (!sessionCookie.includes('merchplace_session=')) {
    throw new Error('Auth verify did not return a Merchplace session cookie.');
  }

  return sessionCookie;
}

class GeneratedWallet {
  constructor(keypair) {
    this.payer = keypair;
    this.publicKey = keypair.publicKey;
  }

  async signTransaction(transaction) {
    transaction.partialSign(this.payer);
    return transaction;
  }

  async signAllTransactions(transactions) {
    return transactions.map((transaction) => {
      transaction.partialSign(this.payer);
      return transaction;
    });
  }
}

async function createListingTransaction({
  connection,
  program,
  seller,
  programId,
  usdcMint,
  listingId,
  priceMicro,
  shippingMicro,
  metadataHashBytes,
}) {
  const [listingPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('listing'),
      seller.publicKey.toBuffer(),
      new anchor.BN(listingId).toArrayLike(Buffer, 'le', 8),
    ],
    programId
  );
  const escrowVault = await getAssociatedTokenAddress(usdcMint, listingPda, true);
  const sellerTokenAccount = await getAssociatedTokenAddress(usdcMint, seller.publicKey);

  const transaction = await program.methods
    .createListing(
      new anchor.BN(listingId),
      new anchor.BN(priceMicro),
      metadataHashBytes,
      new anchor.BN(shippingMicro)
    )
    .preInstructions([
      createAssociatedTokenAccountIdempotentInstruction(
        seller.publicKey,
        sellerTokenAccount,
        seller.publicKey,
        usdcMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
    ])
    .accountsStrict({
      seller: seller.publicKey,
      listing: listingPda,
      usdcMint,
      escrowVault,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  const latest = await connection.getLatestBlockhash('confirmed');
  transaction.feePayer = seller.publicKey;
  transaction.recentBlockhash = latest.blockhash;
  transaction.sign(seller);

  return { transaction, listingPda, latest };
}

async function createBuyTransaction({
  connection,
  program,
  buyer,
  listingPda,
  usdcMint,
}) {
  const escrowVault = await getAssociatedTokenAddress(usdcMint, listingPda, true);
  const buyerTokenAccount = await getAssociatedTokenAddress(usdcMint, buyer.publicKey);
  const transaction = await program.methods
    .buyItem()
    .preInstructions([
      createAssociatedTokenAccountIdempotentInstruction(
        buyer.publicKey,
        buyerTokenAccount,
        buyer.publicKey,
        usdcMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
    ])
    .accountsStrict({
      buyer: buyer.publicKey,
      listing: listingPda,
      usdcMint,
      buyerTokenAccount,
      escrowVault,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();

  const latest = await connection.getLatestBlockhash('confirmed');
  transaction.feePayer = buyer.publicKey;
  transaction.recentBlockhash = latest.blockhash;
  transaction.sign(buyer);

  return { transaction, latest };
}

async function createConfirmReceiptTransaction({
  connection,
  program,
  buyer,
  seller,
  listingPda,
  usdcMint,
  treasury,
}) {
  const escrowVault = await getAssociatedTokenAddress(usdcMint, listingPda, true);
  const sellerTokenAccount = await getAssociatedTokenAddress(usdcMint, seller.publicKey);
  const treasuryTokenAccount = await getAssociatedTokenAddress(usdcMint, treasury, true);
  const transaction = await program.methods
    .confirmReceipt()
    .preInstructions([
      createAssociatedTokenAccountIdempotentInstruction(
        buyer.publicKey,
        sellerTokenAccount,
        seller.publicKey,
        usdcMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
      createAssociatedTokenAccountIdempotentInstruction(
        buyer.publicKey,
        treasuryTokenAccount,
        treasury,
        usdcMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
    ])
    .accountsStrict({
      buyer: buyer.publicKey,
      listing: listingPda,
      usdcMint,
      escrowVault,
      sellerTokenAccount,
      seller: seller.publicKey,
      treasuryTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();

  const latest = await connection.getLatestBlockhash('confirmed');
  transaction.feePayer = buyer.publicKey;
  transaction.recentBlockhash = latest.blockhash;
  transaction.sign(buyer);

  return { transaction, latest };
}

async function createCancelPurchaseTransaction({
  connection,
  program,
  buyer,
  listingPda,
  usdcMint,
}) {
  const escrowVault = await getAssociatedTokenAddress(usdcMint, listingPda, true);
  const buyerTokenAccount = await getAssociatedTokenAddress(usdcMint, buyer.publicKey);
  const transaction = await program.methods
    .cancelPurchase()
    .preInstructions([
      createAssociatedTokenAccountIdempotentInstruction(
        buyer.publicKey,
        buyerTokenAccount,
        buyer.publicKey,
        usdcMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
    ])
    .accountsStrict({
      buyer: buyer.publicKey,
      listing: listingPda,
      usdcMint,
      escrowVault,
      buyerTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();

  const latest = await connection.getLatestBlockhash('confirmed');
  transaction.feePayer = buyer.publicKey;
  transaction.recentBlockhash = latest.blockhash;
  transaction.sign(buyer);

  return { transaction, latest };
}

async function createCancelListingTransaction({
  connection,
  program,
  seller,
  listingPda,
}) {
  const transaction = await program.methods
    .cancelListing()
    .accountsStrict({
      seller: seller.publicKey,
      listing: listingPda,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  const latest = await connection.getLatestBlockhash('confirmed');
  transaction.feePayer = seller.publicKey;
  transaction.recentBlockhash = latest.blockhash;
  transaction.sign(seller);

  return { transaction, latest };
}

async function sendSimulatedTransaction(connection, transaction, latest, label) {
  const simulation = await connection.simulateTransaction(transaction);
  if (simulation.value.err) {
    throw new Error(`${label} simulation failed: ${JSON.stringify(simulation.value.err)}\n${simulation.value.logs?.join('\n') || ''}`);
  }

  const signature = await connection.sendRawTransaction(transaction.serialize(), {
    skipPreflight: false,
  });
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    },
    'confirmed'
  );

  return signature;
}

async function fundBuyerWithTestUsdc({ connection, buyer, usdcMint, rpcUrl }) {
  const feePayer = getDefaultKeypairPath();
  const cliWallet = new PublicKey(runLocalCli('solana', ['address', '-k', feePayer]));
  if (isLocalRpc(rpcUrl)) {
    const cliAirdrop = await connection.requestAirdrop(
      cliWallet,
      getSmokeSolFundingLamports(rpcUrl)
    );
    await confirmSignature(connection, cliAirdrop);
  }

  runLocalCli('spl-token', [
    'create-account',
    usdcMint.toBase58(),
    '--owner',
    buyer.publicKey.toBase58(),
    '--fee-payer',
    feePayer,
    '--url',
    rpcUrl,
  ]);
  runLocalCli('spl-token', [
    'mint',
    usdcMint.toBase58(),
    '100',
    '--recipient-owner',
    buyer.publicKey.toBase58(),
    '--fee-payer',
    feePayer,
    '--mint-authority',
    feePayer,
    '--url',
    rpcUrl,
  ]);
}

async function fundGeneratedWalletSol({ connection, wallet, rpcUrl, label }) {
  const fundingLamports = getSmokeSolFundingLamports(rpcUrl);
  if (isLocalRpc(rpcUrl)) {
    const signature = await connection.requestAirdrop(wallet.publicKey, fundingLamports);
    await confirmSignature(connection, signature);
    return signature;
  }

  const feePayer = readKeypairFile(getDefaultKeypairPath());
  const balance = await connection.getBalance(feePayer.publicKey, 'confirmed');
  if (balance < fundingLamports + 10_000_000) {
    throw new Error(
      `CLI fee payer ${feePayer.publicKey.toBase58()} needs more devnet SOL to fund ${label}.`
    );
  }

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: feePayer.publicKey,
      toPubkey: wallet.publicKey,
      lamports: fundingLamports,
    })
  );
  const latest = await connection.getLatestBlockhash('confirmed');
  transaction.feePayer = feePayer.publicKey;
  transaction.recentBlockhash = latest.blockhash;
  transaction.sign(feePayer);

  return sendSimulatedTransaction(connection, transaction, latest, `Fund ${label}`);
}

async function main() {
  const cwd = process.cwd();
  const env = {
    ...readDotEnv(path.join(cwd, '.env.local')),
    ...process.env,
  };
  const argv = process.argv.slice(2);
  const issues = getLocalnetPublishSmokeIssues({ env, argv });
  const baseUrl = process.env.E2E_BASE_URL || env.E2E_BASE_URL || DEFAULT_BASE_URL;
  const mode = getLocalnetPublishSmokeMode(argv);
  const needsBuyer = mode === 'confirmReceipt' || mode === 'cancelPurchase';
  const needsTreasury = mode === 'confirmReceipt';

  if (needsTreasury && !env.NEXT_PUBLIC_TREASURY_WALLET) {
    issues.push(`NEXT_PUBLIC_TREASURY_WALLET is required for ${LOCALNET_FULL_LIFECYCLE_FLAG}.`);
  }

  if (issues.length > 0) {
    console.error('Publish smoke is not armed:');
    issues.forEach((issue) => console.error(`- ${issue}`));
    console.error('');
    console.error(`Run against localnet: E2E_BASE_URL=${baseUrl} npm run e2e:publish-smoke -- ${LOCALNET_PUBLISH_SMOKE_SEND_FLAG}`);
    console.error(`Run against devnet: E2E_BASE_URL=${baseUrl} npm run e2e:publish-smoke -- --send-devnet-tx`);
    process.exit(1);
  }

  const connection = new Connection(env.NEXT_PUBLIC_SOLANA_RPC_URL, 'confirmed');
  const programId = new PublicKey(env.NEXT_PUBLIC_PROGRAM_ID);
  const usdcMint = new PublicKey(env.NEXT_PUBLIC_USDC_MINT);
  const treasury = env.NEXT_PUBLIC_TREASURY_WALLET
    ? new PublicKey(env.NEXT_PUBLIC_TREASURY_WALLET)
    : null;
  await assertAccountExists(connection, programId, 'Merchplace program');
  await assertAccountExists(connection, usdcMint, 'USDC mint');

  const seller = Keypair.generate();
  const buyer = Keypair.generate();
  await fundGeneratedWalletSol({
    connection,
    wallet: seller,
    rpcUrl: env.NEXT_PUBLIC_SOLANA_RPC_URL,
    label: 'seller',
  });
  if (needsBuyer) {
    await fundGeneratedWalletSol({
      connection,
      wallet: buyer,
      rpcUrl: env.NEXT_PUBLIC_SOLANA_RPC_URL,
      label: 'buyer',
    });
    await fundBuyerWithTestUsdc({
      connection,
      buyer,
      usdcMint,
      rpcUrl: env.NEXT_PUBLIC_SOLANA_RPC_URL,
    });
  }

  const provider = new anchor.AnchorProvider(
    connection,
    new GeneratedWallet(seller),
    { commitment: 'confirmed' }
  );
  const program = new anchor.Program(idlJson, provider);
  const listingId = Date.now();
  const priceMicro = 7_000_000;
  const shippingMethod = DEFAULT_SHIPPING_METHOD;
  const title = `Localnet smoke ${new Date().toISOString()}`;
  const metadata = buildListingMetadata({
    title,
    description: 'Automated localnet publish smoke item.',
    eventName: 'Breakpoint 2025',
    category: 'Cap',
    condition: 'New',
    size: 'One Size',
    shippingMethod: {
      id: shippingMethod.id,
      carrier: shippingMethod.carrier,
      service: shippingMethod.service,
    },
    images: [],
  });
  const metadataHash = await createMetadataHash(metadata);

  console.log('Publish smoke transaction summary:');
  console.log(`- Cluster: ${env.NEXT_PUBLIC_SOLANA_NETWORK}`);
  console.log(`- RPC: ${env.NEXT_PUBLIC_SOLANA_RPC_URL}`);
  console.log(`- Mode: ${mode}`);
  console.log(`- Seller: ${seller.publicKey.toBase58()} (generated, smoke only)`);
  if (needsBuyer) {
    console.log(`- Buyer: ${buyer.publicKey.toBase58()} (generated, smoke only)`);
  }
  console.log(`- Price: ${(priceMicro / 1_000_000).toFixed(2)} USDC`);
  console.log(`- Shipping: ${shippingMethod.carrier} ${shippingMethod.service}`);
  console.log(`- Program: ${programId.toBase58()}`);
  console.log(`- Mint: ${usdcMint.toBase58()}`);

  const { transaction, listingPda, latest } = await createListingTransaction({
    connection,
    program,
    seller,
    programId,
    usdcMint,
    listingId,
    priceMicro,
    shippingMicro: shippingMethod.priceMicro,
    metadataHashBytes: metadataHash.bytes,
  });

  const txSignature = await sendSimulatedTransaction(
    connection,
    transaction,
    latest,
    'Create listing'
  );

  const sessionCookie = await createWalletSession({ baseUrl, keypair: seller });
  const payload = {
    seller_wallet: seller.publicKey.toBase58(),
    listing_id: listingId,
    listing_pda: listingPda.toBase58(),
    title,
    description: 'Automated localnet publish smoke item.',
    event_name: 'Breakpoint 2025',
    category: 'Cap',
    condition: 'New',
    size: 'One Size',
    price_usdc: priceMicro,
    shipping_cost: shippingMethod.priceMicro,
    shipping_method: shippingMethod.id,
    images: [],
    metadata_hash: metadataHash.hex,
    tx_signature: txSignature,
  };

  const created = await fetchRequiredJson(
    new URL('/api/listings', baseUrl),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify(payload),
    },
    'Supabase listing sync'
  );

  console.log('');
  console.log('Publish smoke succeeded.');
  console.log(`- Transaction: ${txSignature}`);
  console.log(`- Listing PDA: ${listingPda.toBase58()}`);
  console.log(`- Supabase listing: ${created.body.listing.id}`);
  console.log(`- Status: ${created.body.listing.status}`);

  if (mode === 'publish') return;
  if (mode === 'cancelListing') {
    const cancelListingTx = await createCancelListingTransaction({
      connection,
      program,
      seller,
      listingPda,
    });
    const cancelListingSignature = await sendSimulatedTransaction(
      connection,
      cancelListingTx.transaction,
      cancelListingTx.latest,
      'Cancel listing'
    );
    const cancelled = await fetchRequiredJson(
      new URL(`/api/listings/${created.body.listing.id}`, baseUrl),
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: sessionCookie,
        },
        body: JSON.stringify({
          status: 'cancelled',
          tx_signature: cancelListingSignature,
        }),
      },
      'Supabase listing cancellation sync'
    );

    console.log('');
    console.log('Seller cancellation smoke succeeded.');
    console.log(`- Cancel listing transaction: ${cancelListingSignature}`);
    console.log(`- Final status: ${cancelled.body.listing.status}`);
    return;
  }

  const buyerCookie = await createWalletSession({ baseUrl, keypair: buyer });
  const buyTx = await createBuyTransaction({
    connection,
    program,
    buyer,
    listingPda,
    usdcMint,
  });
  const buySignature = await sendSimulatedTransaction(
    connection,
    buyTx.transaction,
    buyTx.latest,
    'Buy item'
  );
  const purchased = await fetchRequiredJson(
    new URL(`/api/listings/${created.body.listing.id}`, baseUrl),
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: buyerCookie,
      },
      body: JSON.stringify({
        status: 'in_escrow',
        buyer_wallet: buyer.publicKey.toBase58(),
        tx_signature: buySignature,
      }),
    },
    'Supabase purchase sync'
  );

  if (mode === 'cancelPurchase') {
    const cancelPurchaseTx = await createCancelPurchaseTransaction({
      connection,
      program,
      buyer,
      listingPda,
      usdcMint,
    });
    const cancelPurchaseSignature = await sendSimulatedTransaction(
      connection,
      cancelPurchaseTx.transaction,
      cancelPurchaseTx.latest,
      'Cancel purchase'
    );
    const available = await fetchRequiredJson(
      new URL(`/api/listings/${created.body.listing.id}`, baseUrl),
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: buyerCookie,
        },
        body: JSON.stringify({
          status: 'available',
          buyer_wallet: null,
          tx_signature: cancelPurchaseSignature,
        }),
      },
      'Supabase purchase cancellation sync'
    );

    console.log('');
    console.log('Buyer cancellation smoke succeeded.');
    console.log(`- Purchase transaction: ${buySignature}`);
    console.log(`- Purchase status: ${purchased.body.listing.status}`);
    console.log(`- Cancel purchase transaction: ${cancelPurchaseSignature}`);
    console.log(`- Final status: ${available.body.listing.status}`);
    return;
  }

  if (!treasury) {
    throw new Error('Missing treasury wallet for full lifecycle smoke.');
  }

  const shipment = await fetchRequiredJson(
    new URL(`/api/listings/${created.body.listing.id}/shipping`, baseUrl),
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify(buildSmokeShipment()),
    },
    'Supabase shipment tracking sync'
  );

  const confirmTx = await createConfirmReceiptTransaction({
    connection,
    program,
    buyer,
    seller,
    listingPda,
    usdcMint,
    treasury,
  });
  const confirmReceiptSignature = await sendSimulatedTransaction(
    connection,
    confirmTx.transaction,
    confirmTx.latest,
    'Confirm receipt'
  );
  const sold = await fetchRequiredJson(
    new URL(`/api/listings/${created.body.listing.id}`, baseUrl),
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: buyerCookie,
      },
      body: JSON.stringify({
        status: 'sold',
        tx_signature: confirmReceiptSignature,
      }),
    },
    'Supabase receipt sync'
  );

  console.log('');
  console.log('Full lifecycle smoke succeeded.');
  console.log(`- Purchase transaction: ${buySignature}`);
  console.log(`- Purchase status: ${purchased.body.listing.status}`);
  console.log(`- Tracking: ${shipment.body.shipping.carrier} ${shipment.body.shipping.tracking_number}`);
  console.log(`- Confirm transaction: ${confirmReceiptSignature}`);
  console.log(`- Final status: ${sold.body.listing.status}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
