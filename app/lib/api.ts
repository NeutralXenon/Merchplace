import type { DbListing, DbShipping } from './supabase';

const API_BASE = '/api';
const READ_TIMEOUT_MS = 1_500;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = READ_TIMEOUT_MS
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      cache: 'no-store',
      ...init,
      signal: init.signal || controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

// ============================================
// Listings API
// ============================================

export type ListingsResponse = {
  listings: DbListing[];
  total: number;
  limit: number;
  offset: number;
};

export type ListingFilters = {
  status?: string;
  event?: string;
  category?: string;
  condition?: string;
  search?: string;
  seller?: string;
  buyer?: string;
  limit?: number;
  offset?: number;
};

export type CreateListingPayload = Omit<
  DbListing,
  'id' | 'created_at' | 'updated_at' | 'status' | 'buyer_wallet'
> & {
  tx_signature?: string;
};

type ListingUpdatePayload = Partial<
  Pick<DbListing, 'status' | 'buyer_wallet' | 'listing_pda' | 'images' | 'metadata_hash'>
> & {
  tx_signature?: string;
};

export type ShippingPayload = {
  tracking_number: string;
  carrier: string;
  shipped_at?: string | null;
  delivered_at?: string | null;
};

/**
 * Fetch listings with optional filters.
 */
export async function fetchListings(
  filters: ListingFilters = {}
): Promise<ListingsResponse> {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== '' && value !== 'All Events' && value !== 'All Categories' && value !== 'All Conditions') {
      params.set(key, String(value));
    }
  });

  const res = await fetchWithTimeout(`${API_BASE}/listings?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch listings');
  }
  return res.json();
}

/**
 * Fetch a single listing by ID.
 */
export async function fetchListing(id: string): Promise<DbListing> {
  const res = await fetchWithTimeout(`${API_BASE}/listings/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Listing not found');
  }
  const data = await res.json();
  return data.listing;
}

/**
 * Create a new listing.
 */
export async function createListing(
  listing: CreateListingPayload
): Promise<DbListing> {
  const res = await fetch(`${API_BASE}/listings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(listing),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create listing');
  }
  const data = await res.json();
  return data.listing;
}

/**
 * Update a listing's status or metadata.
 */
export async function updateListing(
  id: string,
  updates: ListingUpdatePayload
): Promise<DbListing> {
  const res = await fetch(`${API_BASE}/listings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update listing');
  }
  const data = await res.json();
  return data.listing;
}

// ============================================
// Shipping API
// ============================================

/**
 * Fetch shipping details for a listing.
 */
export async function fetchShipping(id: string): Promise<DbShipping | null> {
  const res = await fetchWithTimeout(`${API_BASE}/listings/${id}/shipping`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch shipping');
  }
  const data = await res.json();
  return data.shipping ?? null;
}

/**
 * Create or update shipping details for a listing.
 */
export async function upsertShipping(
  id: string,
  shipping: ShippingPayload
): Promise<DbShipping> {
  const res = await fetch(`${API_BASE}/listings/${id}/shipping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(shipping),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save shipping');
  }
  const data = await res.json();
  return data.shipping;
}

// ============================================
// Upload API
// ============================================

/**
 * Upload images to Supabase Storage.
 */
export async function uploadImages(
  files: File[],
  walletAddress: string
): Promise<string[]> {
  const formData = new FormData();
  formData.append('wallet', walletAddress);
  files.forEach((file) => formData.append('files', file));

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Upload failed');
  }

  const data = await res.json();
  return data.urls;
}

// ============================================
// Auth API
// ============================================

/**
 * Register/verify a wallet address.
 */
export async function verifyWallet(
  walletAddress: string,
  displayName?: string
) {
  const res = await fetch(`${API_BASE}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet_address: walletAddress,
      display_name: displayName,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Verification failed');
  }

  return res.json();
}
