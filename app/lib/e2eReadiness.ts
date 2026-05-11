import { PublicKey } from '@solana/web3.js';

export type WalletE2EEnv = {
  NEXT_PUBLIC_SOLANA_RPC_URL?: string;
  NEXT_PUBLIC_SOLANA_NETWORK?: string;
  NEXT_PUBLIC_PROGRAM_ID?: string;
  NEXT_PUBLIC_USDC_MINT?: string;
  NEXT_PUBLIC_TREASURY_WALLET?: string;
};

export type WalletE2EConfigIssue = {
  severity: 'blocker' | 'warning';
  field: keyof WalletE2EEnv;
  message: string;
};

export type ManualWalletE2EStep = {
  id: string;
  actor: 'seller' | 'buyer';
  action: string;
  expected: string;
};

const PUBLIC_KEY_FIELDS: Array<keyof WalletE2EEnv> = [
  'NEXT_PUBLIC_PROGRAM_ID',
  'NEXT_PUBLIC_USDC_MINT',
  'NEXT_PUBLIC_TREASURY_WALLET',
];

const PLACEHOLDER_VALUES = new Set([
  'YOUR_TREASURY_WALLET_ADDRESS_HERE',
  'YOUR_PROGRAM_ID_HERE',
  'YOUR_USDC_MINT_HERE',
]);

function isBlank(value: string | undefined): boolean {
  return !value || value.trim().length === 0;
}

function isValidPublicKey(value: string): boolean {
  try {
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

export function getWalletE2EConfigIssues(env: WalletE2EEnv): WalletE2EConfigIssue[] {
  const issues: WalletE2EConfigIssue[] = [];

  if (isBlank(env.NEXT_PUBLIC_SOLANA_RPC_URL)) {
    issues.push({
      severity: 'blocker',
      field: 'NEXT_PUBLIC_SOLANA_RPC_URL',
      message: 'Set a Solana RPC URL before running wallet E2E.',
    });
  }

  if (isBlank(env.NEXT_PUBLIC_SOLANA_NETWORK)) {
    issues.push({
      severity: 'blocker',
      field: 'NEXT_PUBLIC_SOLANA_NETWORK',
      message: 'Set the Solana network label so the browser and wallet use the same cluster.',
    });
  }

  PUBLIC_KEY_FIELDS.forEach((field) => {
    const value = env[field]?.trim();

    if (!value) {
      issues.push({
        severity: 'blocker',
        field,
        message: `${field} is required for wallet E2E.`,
      });
      return;
    }

    if (PLACEHOLDER_VALUES.has(value)) {
      issues.push({
        severity: 'blocker',
        field,
        message: `${field} must be a real treasury wallet, program, or mint address before wallet E2E.`,
      });
      return;
    }

    if (!isValidPublicKey(value)) {
      issues.push({
        severity: 'blocker',
        field,
        message: `${field} must be a valid Solana public key.`,
      });
    }
  });

  const rpcUrl = env.NEXT_PUBLIC_SOLANA_RPC_URL?.toLowerCase() ?? '';
  const network = env.NEXT_PUBLIC_SOLANA_NETWORK?.toLowerCase() ?? '';

  if ((rpcUrl.includes('127.0.0.1') || rpcUrl.includes('localhost')) && network !== 'localnet') {
    issues.push({
      severity: 'blocker',
      field: 'NEXT_PUBLIC_SOLANA_NETWORK',
      message: 'Local RPC URLs must use NEXT_PUBLIC_SOLANA_NETWORK=localnet for wallet E2E.',
    });
  }

  if (network === 'devnet') {
    issues.push({
      severity: 'warning',
      field: 'NEXT_PUBLIC_PROGRAM_ID',
      message: 'Devnet wallet E2E requires the configured program ID and USDC mint to be deployed and funded on devnet.',
    });
  }

  return issues;
}

export function getManualWalletE2ESteps(): ManualWalletE2EStep[] {
  return [
    {
      id: 'seller-connect',
      actor: 'seller',
      action: 'Connect the seller wallet on the configured cluster and open /listing/create.',
      expected: 'The sell form unlocks, shows escrow math, and the network badge matches the wallet cluster.',
    },
    {
      id: 'create-listing',
      actor: 'seller',
      action: 'Create a listing with title, description, event, price, and carrier shipping method, then sign publish.',
      expected: 'The transaction reaches success and the app navigates to the new listing detail page.',
    },
    {
      id: 'buyer-connect',
      actor: 'buyer',
      action: 'Switch to a funded buyer wallet on the same cluster and open the new listing.',
      expected: 'The listing shows Buy now, escrow policy, and dispute/timeout guidance.',
    },
    {
      id: 'buy-listing',
      actor: 'buyer',
      action: 'Review purchase and sign the buy transaction.',
      expected: 'Status becomes in escrow and buyer actions appear.',
    },
    {
      id: 'seller-tracking',
      actor: 'seller',
      action: 'Return with the seller wallet and save carrier plus tracking number.',
      expected: 'Tracking persists and the buyer sees shipment details.',
    },
    {
      id: 'buyer-final-state',
      actor: 'buyer',
      action: 'Return with the buyer wallet and confirm receipt or cancel purchase.',
      expected: 'Confirm marks the listing sold; cancel returns the listing to available.',
    },
  ];
}
