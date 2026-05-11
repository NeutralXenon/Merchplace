export const LOCALNET_PUBLISH_SMOKE_SEND_FLAG = '--send-localnet-tx';
export const DEVNET_PUBLISH_SMOKE_SEND_FLAG = '--send-devnet-tx';
export const LOCALNET_FULL_LIFECYCLE_FLAG = '--full-lifecycle';
export const LOCALNET_CANCEL_PURCHASE_FLAG = '--cancel-purchase';
export const LOCALNET_CANCEL_LISTING_FLAG = '--cancel-listing';
const LAMPORTS_PER_SOL = 1_000_000_000;
const LOCALNET_SMOKE_SOL_FUNDING = LAMPORTS_PER_SOL;
const DEVNET_SMOKE_SOL_FUNDING = 50_000_000;

export type LocalnetPublishSmokeMode =
  | 'publish'
  | 'confirmReceipt'
  | 'cancelPurchase'
  | 'cancelListing';

const LIFECYCLE_MODE_FLAGS: Array<{
  flag: string;
  mode: Exclude<LocalnetPublishSmokeMode, 'publish'>;
}> = [
  { flag: LOCALNET_FULL_LIFECYCLE_FLAG, mode: 'confirmReceipt' },
  { flag: LOCALNET_CANCEL_PURCHASE_FLAG, mode: 'cancelPurchase' },
  { flag: LOCALNET_CANCEL_LISTING_FLAG, mode: 'cancelListing' },
];

export type PublishSmokeEnv = {
  NEXT_PUBLIC_SOLANA_RPC_URL?: string;
  NEXT_PUBLIC_SOLANA_NETWORK?: string;
  NEXT_PUBLIC_PROGRAM_ID?: string;
  NEXT_PUBLIC_USDC_MINT?: string;
};

export type ListingMetadataInput = {
  title: string;
  description: string;
  eventName: string;
  category: string;
  condition: string;
  size: string;
  shippingMethod: {
    id: string;
    carrier: string;
    service: string;
  };
  images: string[];
};

export type SmokeShipmentPayload = {
  carrier: string;
  tracking_number: string;
  shipped_at: string | null;
  delivered_at: string | null;
};

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

function isLocalRpc(value: string | undefined): boolean {
  const normalized = value?.toLowerCase() ?? '';
  return normalized.includes('127.0.0.1') || normalized.includes('localhost');
}

function isDevnetRpc(value: string | undefined): boolean {
  const normalized = value?.toLowerCase() ?? '';
  return normalized.includes('devnet');
}

export function getSmokeSolFundingLamports(rpcUrl: string | undefined): number {
  return isLocalRpc(rpcUrl) ? LOCALNET_SMOKE_SOL_FUNDING : DEVNET_SMOKE_SOL_FUNDING;
}

function getSelectedModeFlags(argv: string[]) {
  return LIFECYCLE_MODE_FLAGS.filter(({ flag }) => argv.includes(flag));
}

export function getLocalnetPublishSmokeMode(argv: string[]): LocalnetPublishSmokeMode {
  return getSelectedModeFlags(argv)[0]?.mode ?? 'publish';
}

export function getLocalnetPublishSmokeIssues({
  env,
  argv,
}: {
  env: PublishSmokeEnv;
  argv: string[];
}): string[] {
  const issues: string[] = [];

  const network = env.NEXT_PUBLIC_SOLANA_NETWORK?.toLowerCase();
  const armedForLocalnet = argv.includes(LOCALNET_PUBLISH_SMOKE_SEND_FLAG);
  const armedForDevnet = argv.includes(DEVNET_PUBLISH_SMOKE_SEND_FLAG);

  if (!armedForLocalnet && !armedForDevnet) {
    issues.push(
      `Pass ${LOCALNET_PUBLISH_SMOKE_SEND_FLAG} or ${DEVNET_PUBLISH_SMOKE_SEND_FLAG} to send generated-wallet transactions.`
    );
  }

  if (armedForLocalnet && armedForDevnet) {
    issues.push(`Choose only one send flag: ${LOCALNET_PUBLISH_SMOKE_SEND_FLAG} or ${DEVNET_PUBLISH_SMOKE_SEND_FLAG}.`);
  }

  const selectedModeFlags = getSelectedModeFlags(argv);
  if (selectedModeFlags.length > 1) {
    issues.push(
      `Choose only one lifecycle mode: ${selectedModeFlags.map(({ flag }) => flag).join(', ')}.`
    );
  }

  if (isBlank(env.NEXT_PUBLIC_SOLANA_RPC_URL)) {
    issues.push('NEXT_PUBLIC_SOLANA_RPC_URL is required.');
  }

  if (isBlank(env.NEXT_PUBLIC_SOLANA_NETWORK)) {
    issues.push('NEXT_PUBLIC_SOLANA_NETWORK is required.');
  }

  if (armedForLocalnet && network !== 'localnet') {
    issues.push('The localnet send flag requires NEXT_PUBLIC_SOLANA_NETWORK=localnet.');
  }

  if (armedForLocalnet && !isLocalRpc(env.NEXT_PUBLIC_SOLANA_RPC_URL)) {
    issues.push('The localnet send flag only sends to localhost or 127.0.0.1 RPC URLs.');
  }

  if (armedForDevnet && network !== 'devnet') {
    issues.push('The devnet send flag requires NEXT_PUBLIC_SOLANA_NETWORK=devnet.');
  }

  if (armedForDevnet && !isDevnetRpc(env.NEXT_PUBLIC_SOLANA_RPC_URL)) {
    issues.push('The devnet send flag only sends to devnet RPC URLs.');
  }

  if (isBlank(env.NEXT_PUBLIC_PROGRAM_ID)) {
    issues.push('NEXT_PUBLIC_PROGRAM_ID is required.');
  }

  if (isBlank(env.NEXT_PUBLIC_USDC_MINT)) {
    issues.push('NEXT_PUBLIC_USDC_MINT is required.');
  }

  return issues;
}

export function buildListingMetadata(input: ListingMetadataInput): string {
  return JSON.stringify({
    title: input.title,
    description: input.description,
    eventName: input.eventName,
    category: input.category,
    condition: input.condition,
    size: input.size,
    shippingMethod: {
      id: input.shippingMethod.id,
      carrier: input.shippingMethod.carrier,
      service: input.shippingMethod.service,
    },
    images: input.images,
  });
}

export function buildSmokeShipment(): SmokeShipmentPayload {
  return {
    carrier: 'DPD',
    tracking_number: 'LOCALNET-SMOKE-11111',
    shipped_at: null,
    delivered_at: null,
  };
}

export async function createMetadataHash(metadata: string): Promise<{
  bytes: number[];
  hex: string;
}> {
  const encoded = new TextEncoder().encode(metadata);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');

  return { bytes, hex };
}

export function getCookieHeader(setCookieHeaders: string[]): string {
  return setCookieHeaders
    .map((header) => header.split(';')[0]?.trim())
    .filter(Boolean)
    .join('; ');
}
