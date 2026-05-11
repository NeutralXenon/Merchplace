import { LAMPORTS_PER_SOL, type Connection, type PublicKey } from '@solana/web3.js';

const MIN_FEE_PAYER_LAMPORTS = 50_000_000; // 0.05 SOL covers localnet account rent + fees.
const LOCALNET_AIRDROP_LAMPORTS = 2 * LAMPORTS_PER_SOL;

type FundingConnection = Pick<
  Connection,
  'getBalance' | 'requestAirdrop' | 'confirmTransaction'
> & {
  rpcEndpoint?: string;
};

export function isLocalSolanaEndpoint(endpoint: string | undefined) {
  if (!endpoint) return false;

  try {
    const { hostname } = new URL(endpoint);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

export function isNoPriorCreditError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : typeof error === 'string'
        ? error.toLowerCase()
        : '';
  return (
    message.includes('attempt to debit an account') &&
    message.includes('no record of a prior credit')
  );
}

export function getWalletFundingErrorMessage(networkOrEndpoint: string | undefined) {
  if (
    networkOrEndpoint === 'localnet' ||
    isLocalSolanaEndpoint(networkOrEndpoint)
  ) {
    return 'Your wallet has no SOL on localnet yet. Fund it on the local validator, then try publishing again.';
  }

  return 'Your wallet needs SOL on the selected Solana network to pay transaction fees and account rent before publishing.';
}

export async function ensureWalletHasFeeLamports(
  connection: FundingConnection,
  wallet: Pick<PublicKey, 'toBase58'>,
) {
  const balance = await connection.getBalance(wallet as PublicKey);
  if (balance >= MIN_FEE_PAYER_LAMPORTS) {
    return { airdropped: false, balance };
  }

  if (!isLocalSolanaEndpoint(connection.rpcEndpoint)) {
    throw new Error(getWalletFundingErrorMessage(connection.rpcEndpoint));
  }

  const signature = await connection.requestAirdrop(
    wallet as PublicKey,
    LOCALNET_AIRDROP_LAMPORTS
  );
  await connection.confirmTransaction(signature, 'confirmed');

  return {
    airdropped: true,
    balance: balance + LOCALNET_AIRDROP_LAMPORTS,
  };
}
