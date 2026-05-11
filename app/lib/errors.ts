export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string' && error.trim()) {
    return error;
  }

  return fallback;
}

export function getWalletErrorMessage(error: unknown, fallback: string): string {
  const message = getErrorMessage(error, fallback);
  return message.toLowerCase().includes('rejected')
    ? 'Transaction was rejected by the wallet'
    : message;
}
