export type ListingStatusSyncAction = 'buy' | 'confirm' | 'cancelPurchase' | 'cancelListing';

const ACTION_LABELS: Record<ListingStatusSyncAction, string> = {
  buy: 'purchase',
  confirm: 'receipt confirmation',
  cancelPurchase: 'purchase cancellation',
  cancelListing: 'listing cancellation',
};

function getSyncErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Status sync failed';
}

export function getListingStatusSyncErrorMessage(
  action: ListingStatusSyncAction,
  error: unknown
): string {
  return `On-chain ${ACTION_LABELS[action]} succeeded, but Supabase sync failed: ${getSyncErrorText(
    error
  )}`;
}
