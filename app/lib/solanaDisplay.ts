export type SolanaCluster = 'devnet' | 'testnet' | 'mainnet-beta' | 'localnet';

export type MarketplaceTotals = {
  itemMicro: number;
  shippingMicro: number;
  buyerProtectionMicro: number;
  buyerPaysMicro: number;
  sellerReceivesMicro: number;
};

const DEFAULT_CLUSTER: SolanaCluster = 'devnet';
const PLATFORM_FEE_BPS = 500;
const BPS_DENOMINATOR = 10_000;
const MICRO_USDC = 1_000_000;

export function getSolanaCluster(value?: string): SolanaCluster {
  const raw = (value || process.env.NEXT_PUBLIC_SOLANA_NETWORK || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || '')
    .toLowerCase();

  if (raw.includes('mainnet')) return 'mainnet-beta';
  if (raw.includes('testnet')) return 'testnet';
  if (raw.includes('localhost') || raw.includes('127.0.0.1') || raw.includes('localnet')) {
    return 'localnet';
  }
  if (raw.includes('devnet')) return 'devnet';

  return DEFAULT_CLUSTER;
}

export function getClusterLabel(cluster: SolanaCluster): string {
  if (cluster === 'mainnet-beta') return 'Mainnet';
  if (cluster === 'localnet') return 'Localnet';
  return cluster.charAt(0).toUpperCase() + cluster.slice(1);
}

export function canOpenSolscan(cluster: SolanaCluster = getSolanaCluster()): boolean {
  return cluster !== 'localnet';
}

function solscanClusterQuery(cluster: SolanaCluster): string {
  if (cluster === 'mainnet-beta') return '';
  if (cluster === 'localnet') return '?cluster=custom';
  return `?cluster=${cluster}`;
}

export function buildSolscanTxUrl(signature: string, cluster = getSolanaCluster()): string {
  return `https://solscan.io/tx/${signature}${solscanClusterQuery(cluster)}`;
}

export function buildSolscanAddressUrl(address: string, cluster = getSolanaCluster()): string {
  return `https://solscan.io/account/${address}${solscanClusterQuery(cluster)}`;
}

export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatUsdcMicro(amountMicro: number): string {
  if (!Number.isFinite(amountMicro)) return '0.00';
  return (amountMicro / MICRO_USDC).toFixed(2);
}

export function getMarketplaceTotals(priceMicro: number, shippingMicro: number): MarketplaceTotals {
  const itemMicro = Math.max(0, Math.trunc(priceMicro));
  const normalizedShippingMicro = Math.max(0, Math.trunc(shippingMicro));
  const buyerProtectionMicro = Math.trunc((itemMicro * PLATFORM_FEE_BPS) / BPS_DENOMINATOR);

  return {
    itemMicro,
    shippingMicro: normalizedShippingMicro,
    buyerProtectionMicro,
    buyerPaysMicro: itemMicro + normalizedShippingMicro + buyerProtectionMicro,
    sellerReceivesMicro: itemMicro + normalizedShippingMicro,
  };
}
