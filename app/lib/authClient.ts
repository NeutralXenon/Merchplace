import type { PublicKey } from '@solana/web3.js';

type SignMessage = (message: Uint8Array) => Promise<Uint8Array>;

function signatureToBase64(signature: Uint8Array): string {
  let binary = '';
  signature.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export async function ensureWalletSession(
  publicKey: PublicKey | null,
  signMessage: SignMessage | undefined
): Promise<void> {
  if (!publicKey) {
    throw new Error('Connect your wallet before continuing.');
  }
  if (!signMessage) {
    throw new Error('This wallet does not support message signing.');
  }

  const walletAddress = publicKey.toBase58();
  const sessionRes = await fetch('/api/auth/session');
  if (sessionRes.ok) {
    const session = (await sessionRes.json()) as {
      authenticated?: boolean;
      wallet_address?: string | null;
    };
    if (session.authenticated && session.wallet_address === walletAddress) {
      return;
    }
  }

  const nonceRes = await fetch('/api/auth/nonce', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet_address: walletAddress }),
  });

  if (!nonceRes.ok) {
    throw new Error('Could not start wallet verification.');
  }

  const { message } = (await nonceRes.json()) as { message: string };
  const encoded = new TextEncoder().encode(message);
  const signature = await signMessage(encoded);

  const verifyRes = await fetch('/api/auth/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet_address: walletAddress,
      message,
      signature: signatureToBase64(signature),
    }),
  });

  if (!verifyRes.ok) {
    throw new Error('Wallet verification failed.');
  }
}
