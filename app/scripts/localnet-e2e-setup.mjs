import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PublicKey } from '@solana/web3.js';
import {
  getLocalnetSetupPlan,
  parseLocalnetSetupArgs,
  readEnvValue,
} from '../lib/localnetE2eSetup.ts';

const LOCAL_RPC = 'http://127.0.0.1:8899';
const PROGRAM_ID = 'BWM5Sppg3Qu2mZCGM9ZiwWxDe9st3y4x3rb4Yur7Hauj';
const DEFAULT_TEST_TREASURY = 'GMjnAmWpvW55ffM635MTKY3VAGXbmnpRBJ6NyqjKrMwb';
const DEFAULT_AIRDROP_SOL = '5';
const DEFAULT_TEST_USDC = '1000';
const VALIDATOR_COMMAND = `NO_DNA=1 solana-test-validator --reset --ledger .anchor/e2e-ledger --bpf-program ${PROGRAM_ID} target/deploy/merchplace.so`;

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    encoding: 'utf8',
    env: { ...process.env, NO_DNA: '1' },
    stdio: options.silent ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'pipe', 'inherit'],
  });
  return output.trim();
}

function assertPubkey(label, value) {
  if (!value) return undefined;

  try {
    return new PublicKey(value).toBase58();
  } catch {
    throw new Error(`${label} must be a valid Solana public key.`);
  }
}

function updateEnvFile(filePath, updates) {
  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, 'utf8')
    : '';
  const lines = existing.split(/\r?\n/);
  const seen = new Set();

  const nextLines = lines.map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=/);
    if (!match) return line;

    const key = match[1];
    if (!(key in updates)) return line;

    seen.add(key);
    return `${key}=${updates[key]}`;
  });

  Object.entries(updates).forEach(([key, value]) => {
    if (!seen.has(key)) nextLines.push(`${key}=${value}`);
  });

  fs.writeFileSync(filePath, `${nextLines.join('\n').replace(/\n{3,}/g, '\n\n').trim()}\n`);
}

function createMint(feePayer) {
  const output = run('spl-token', [
    'create-token',
    '--decimals',
    '6',
    '--fee-payer',
    feePayer,
    '--url',
    LOCAL_RPC,
    '--output',
    'json',
  ], { silent: true });
  const parsed = JSON.parse(output);

  return parsed.commandOutput?.address || parsed.address;
}

function getAssociatedTokenAccount(wallet, mint) {
  const output = run('spl-token', [
    'address',
    '--verbose',
    '--token',
    mint,
    '--owner',
    wallet,
    '--url',
    LOCAL_RPC,
    '--output',
    'json',
  ], { silent: true });
  const parsed = JSON.parse(output);

  return parsed.associatedTokenAddress;
}

function accountExists(address) {
  try {
    run('solana', ['account', address, '--url', LOCAL_RPC], { silent: true });
    return true;
  } catch {
    return false;
  }
}

function getDefaultKeypairPath() {
  const output = run('solana', ['config', 'get', 'keypair'], { silent: true });
  const match = output.match(/Key Path:\s*(.+)$/m);
  if (!match) {
    throw new Error('Unable to find a Solana CLI keypair path. Pass --fee-payer <KEYPAIR_PATH>.');
  }

  return match[1].trim();
}

function readEnvFile(filePath) {
  const contents = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';

  return {
    NEXT_PUBLIC_USDC_MINT:
      process.env.NEXT_PUBLIC_USDC_MINT || readEnvValue(contents, 'NEXT_PUBLIC_USDC_MINT'),
    NEXT_PUBLIC_TREASURY_WALLET:
      process.env.NEXT_PUBLIC_TREASURY_WALLET ||
      readEnvValue(contents, 'NEXT_PUBLIC_TREASURY_WALLET'),
  };
}

function fundWallet(label, wallet, mint, solAmount, tokenAmount, feePayer) {
  console.log(`Funding ${label}: ${wallet}`);
  run('solana', ['airdrop', solAmount, wallet, '--url', LOCAL_RPC]);

  const tokenAccount = getAssociatedTokenAccount(wallet, mint);
  if (!accountExists(tokenAccount)) {
    run('spl-token', [
      'create-account',
      mint,
      '--owner',
      wallet,
      '--fee-payer',
      feePayer,
      '--url',
      LOCAL_RPC,
    ]);
  }

  run('spl-token', [
    'mint',
    mint,
    tokenAmount,
    '--recipient-owner',
    wallet,
    '--fee-payer',
    feePayer,
    '--url',
    LOCAL_RPC,
  ]);
}

const args = parseLocalnetSetupArgs(process.argv.slice(2));
const cwd = process.cwd();
const envPath = path.join(cwd, '.env.local');
const setupPlan = getLocalnetSetupPlan({
  args,
  env: readEnvFile(envPath),
});

const seller = assertPubkey('seller', args.seller);
const buyer = assertPubkey('buyer', args.buyer);
const treasury = assertPubkey(
  'treasury',
  setupPlan.treasury || DEFAULT_TEST_TREASURY,
);
const solAmount = args.sol || DEFAULT_AIRDROP_SOL;
const tokenAmount = args.usdc || DEFAULT_TEST_USDC;
const feePayer = setupPlan.checkOnly
  ? args['fee-payer']
  : args['fee-payer'] || getDefaultKeypairPath();

try {
  run('solana', ['cluster-version', '--url', LOCAL_RPC], { silent: true });
} catch {
  console.error('Local validator is not reachable at http://127.0.0.1:8899.');
  console.error('Start it from the workspace root with:');
  console.error(VALIDATOR_COMMAND);
  process.exit(1);
}

try {
  run('solana', ['program', 'show', PROGRAM_ID, '--url', LOCAL_RPC], { silent: true });
} catch {
  console.error(`Local validator is reachable, but merchplace program ${PROGRAM_ID} is not loaded.`);
  console.error('Restart it from the workspace root with:');
  console.error(VALIDATOR_COMMAND);
  process.exit(1);
}

const mint = assertPubkey('mint', setupPlan.mint);

if (setupPlan.checkOnly) {
  if (!mint) {
    console.error('Check-only mode needs NEXT_PUBLIC_USDC_MINT in .env.local or --mint <MINT>.');
    process.exit(1);
  }

  try {
    run('solana', ['account', mint, '--url', LOCAL_RPC], { silent: true });
  } catch {
    console.error(`Configured mint was not found on localnet: ${mint}`);
    process.exit(1);
  }

  console.log('');
  console.log('Localnet E2E check passed.');
  console.log(`RPC: ${LOCAL_RPC}`);
  console.log(`Mint: ${mint}`);
  console.log(`Treasury: ${treasury}`);
  process.exit(0);
}

if (!feePayer) {
  throw new Error('Unable to find a Solana CLI keypair path. Pass --fee-payer <KEYPAIR_PATH>.');
}

const feePayerWallet = run('solana', ['address', '-k', feePayer], { silent: true });
run('solana', ['airdrop', '10', feePayerWallet, '--url', LOCAL_RPC]);

let activeMint = mint;
if (!activeMint || !accountExists(activeMint)) {
  if (activeMint) {
    console.warn(`Configured mint was not found on localnet, creating a fresh test mint: ${activeMint}`);
  }
  activeMint = createMint(feePayer);
}

if (setupPlan.shouldUpdateEnv) {
  updateEnvFile(envPath, {
    NEXT_PUBLIC_SOLANA_RPC_URL: LOCAL_RPC,
    NEXT_PUBLIC_SOLANA_NETWORK: 'localnet',
    NEXT_PUBLIC_USDC_MINT: activeMint,
    NEXT_PUBLIC_TREASURY_WALLET: treasury,
    NEXT_PUBLIC_PROGRAM_ID: PROGRAM_ID,
  });
}

if (setupPlan.shouldFundWallets && seller) {
  fundWallet('seller wallet', seller, activeMint, solAmount, tokenAmount, feePayer);
}

if (setupPlan.shouldFundWallets && buyer) {
  fundWallet('buyer wallet', buyer, activeMint, solAmount, tokenAmount, feePayer);
}

console.log('');
console.log('Localnet E2E env ready.');
console.log(`RPC: ${LOCAL_RPC}`);
console.log(`Mint: ${activeMint}`);
console.log(`Treasury: ${treasury}`);
console.log('');
console.log('Rebuild/restart the app so Next.js bakes in the updated NEXT_PUBLIC_* values.');
