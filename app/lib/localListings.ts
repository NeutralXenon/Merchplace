import type { DbListing } from './supabase';
import type { DbShipping } from './supabase';
import type { ListingFilters } from './api';

const STORAGE_KEY = 'merchplace:listings:v1';
const SHIPPING_STORAGE_KEY = 'merchplace:shipping:v1';

export const DEMO_LISTINGS: DbListing[] = [
  {
    id: 'demo-1',
    seller_wallet: 'ABcD1234DemoWallet111111111111111111111111111',
    listing_pda: null,
    listing_id: 1,
    title: 'Breakpoint 2025 Limited Edition Hoodie',
    description:
      'Official Breakpoint 2025 hoodie, never worn, still in original packaging. Black with the Solana gradient logo on the back.',
    event_name: 'Breakpoint 2025',
    category: 'Hoodie',
    condition: 'New',
    size: 'L',
    price_usdc: 45_000_000,
    shipping_cost: 5_000_000,
    images: [],
    status: 'available',
    buyer_wallet: null,
    metadata_hash: null,
    created_at: '2026-04-10T12:00:00Z',
    updated_at: '2026-04-10T12:00:00Z',
  },
  {
    id: 'demo-7',
    seller_wallet: 'BrkP2025Collector777777777777777777777777777',
    listing_pda: null,
    listing_id: 7,
    title: 'Breakpoint 2025 Speaker Tee',
    description:
      'Speaker-only tee from the Breakpoint 2025 programming track. Folded after pickup, never washed, with event tag still attached.',
    event_name: 'Breakpoint 2025',
    category: 'T-Shirt',
    condition: 'New',
    size: 'M',
    price_usdc: 32_000_000,
    shipping_cost: 4_000_000,
    images: [],
    status: 'available',
    buyer_wallet: null,
    metadata_hash: null,
    created_at: '2026-04-09T16:00:00Z',
    updated_at: '2026-04-09T16:00:00Z',
  },
  {
    id: 'demo-8',
    seller_wallet: 'BrkP2025Team8888888888888888888888888888888',
    listing_pda: null,
    listing_id: 8,
    title: 'Breakpoint 2025 Badge + Lanyard Set',
    description:
      'Complete attendee badge, lanyard, and venue wristband set. Best for collectors who want the full event artifact.',
    event_name: 'Breakpoint 2025',
    category: 'Badge',
    condition: 'Good',
    size: 'One Size',
    price_usdc: 18_000_000,
    shipping_cost: 2_500_000,
    images: [],
    status: 'available',
    buyer_wallet: null,
    metadata_hash: null,
    created_at: '2026-04-09T12:00:00Z',
    updated_at: '2026-04-09T12:00:00Z',
  },
  {
    id: 'demo-9',
    seller_wallet: 'BrkP2025Sponsor999999999999999999999999999',
    listing_pda: null,
    listing_id: 9,
    title: 'Breakpoint 2025 Sponsor Sticker Pack',
    description:
      'Unopened sponsor sticker pack with Solana ecosystem project stickers from the venue floor.',
    event_name: 'Breakpoint 2025',
    category: 'Sticker Pack',
    condition: 'New',
    size: 'One Size',
    price_usdc: 12_000_000,
    shipping_cost: 1_500_000,
    images: [],
    status: 'available',
    buyer_wallet: null,
    metadata_hash: null,
    created_at: '2026-04-08T18:00:00Z',
    updated_at: '2026-04-08T18:00:00Z',
  },
  {
    id: 'demo-10',
    seller_wallet: 'BrkP2025Venue1010101010101010101010101010',
    listing_pda: null,
    listing_id: 10,
    title: 'Breakpoint 2025 Venue Tote',
    description:
      'Canvas tote from attendee check-in. Lightly used during the event and kept clean afterward.',
    event_name: 'Breakpoint 2025',
    category: 'Bag',
    condition: 'Like New',
    size: 'One Size',
    price_usdc: 28_000_000,
    shipping_cost: 4_500_000,
    images: [],
    status: 'in_escrow',
    buyer_wallet: null,
    metadata_hash: null,
    created_at: '2026-04-07T20:00:00Z',
    updated_at: '2026-04-07T20:00:00Z',
  },
  {
    id: 'demo-11',
    seller_wallet: 'BrkP2025Cap111111111111111111111111111111',
    listing_pda: null,
    listing_id: 11,
    title: 'Breakpoint 2025 Embroidered Cap',
    description:
      'Black embroidered cap from the event shop. Worn once for photos, no stains or shape damage.',
    event_name: 'Breakpoint 2025',
    category: 'Cap',
    condition: 'Like New',
    size: 'One Size',
    price_usdc: 24_000_000,
    shipping_cost: 3_000_000,
    images: [],
    status: 'sold',
    buyer_wallet: null,
    metadata_hash: null,
    created_at: '2026-04-07T14:00:00Z',
    updated_at: '2026-04-07T14:00:00Z',
  },
  {
    id: 'demo-2',
    seller_wallet: 'EfGh5678DemoWallet222222222222222222222222222',
    listing_pda: null,
    listing_id: 2,
    title: 'Solana Hacker House Tokyo T-Shirt',
    description:
      'Exclusive tee from the Tokyo Hacker House event. White cotton, minimalist Solana logo. Worn once, in great condition.',
    event_name: 'Hacker House Tokyo',
    category: 'T-Shirt',
    condition: 'Like New',
    size: 'M',
    price_usdc: 25_000_000,
    shipping_cost: 3_000_000,
    images: [],
    status: 'available',
    buyer_wallet: null,
    metadata_hash: null,
    created_at: '2026-04-08T12:00:00Z',
    updated_at: '2026-04-08T12:00:00Z',
  },
  {
    id: 'demo-3',
    seller_wallet: 'IjKl9012DemoWallet333333333333333333333333333',
    listing_pda: null,
    listing_id: 3,
    title: 'Colosseum Hackathon Winner Cap',
    description: 'Cap given to hackathon winners at Colosseum 2025.',
    event_name: 'Colosseum 2025',
    category: 'Cap',
    condition: 'Good',
    size: 'One Size',
    price_usdc: 15_000_000,
    shipping_cost: 2_000_000,
    images: [],
    status: 'available',
    buyer_wallet: null,
    metadata_hash: null,
    created_at: '2026-04-05T12:00:00Z',
    updated_at: '2026-04-05T12:00:00Z',
  },
  {
    id: 'demo-4',
    seller_wallet: 'MnOp3456DemoWallet444444444444444444444444444',
    listing_pda: null,
    listing_id: 4,
    title: 'Superteam Contributor Backpack',
    description: 'Limited run backpack for Superteam contributors.',
    event_name: 'Superteam Summit',
    category: 'Bag',
    condition: 'New',
    size: 'One Size',
    price_usdc: 60_000_000,
    shipping_cost: 8_000_000,
    images: [],
    status: 'in_escrow',
    buyer_wallet: null,
    metadata_hash: null,
    created_at: '2026-04-03T12:00:00Z',
    updated_at: '2026-04-03T12:00:00Z',
  },
  {
    id: 'demo-5',
    seller_wallet: 'QrSt7890DemoWallet555555555555555555555555555',
    listing_pda: null,
    listing_id: 5,
    title: 'Phantom Wallet Launch Day Socks',
    description: 'Rare socks from the Phantom launch event.',
    event_name: 'Phantom Launch',
    category: 'Accessories',
    condition: 'New',
    size: 'One Size',
    price_usdc: 10_000_000,
    shipping_cost: 2_000_000,
    images: [],
    status: 'available',
    buyer_wallet: null,
    metadata_hash: null,
    created_at: '2026-04-01T12:00:00Z',
    updated_at: '2026-04-01T12:00:00Z',
  },
  {
    id: 'demo-6',
    seller_wallet: 'UvWx1234DemoWallet666666666666666666666666666',
    listing_pda: null,
    listing_id: 6,
    title: 'Solana Foundation Bomber Jacket',
    description: 'Official Solana Foundation bomber, size XL.',
    event_name: 'Breakpoint 2024',
    category: 'Jacket',
    condition: 'Like New',
    size: 'XL',
    price_usdc: 80_000_000,
    shipping_cost: 7_000_000,
    images: [],
    status: 'sold',
    buyer_wallet: null,
    metadata_hash: null,
    created_at: '2026-03-28T12:00:00Z',
    updated_at: '2026-03-28T12:00:00Z',
  },
];

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

function readStoredListings(): DbListing[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DbListing[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredListings(listings: DbListing[]): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(listings));
}

function readStoredShipping(): DbShipping[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(SHIPPING_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DbShipping[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredShipping(records: DbShipping[]): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(SHIPPING_STORAGE_KEY, JSON.stringify(records));
}

export function saveLocalListing(listing: DbListing): void {
  const listings = readStoredListings();
  const next = [
    listing,
    ...listings.filter((item) => item.id !== listing.id && item.listing_pda !== listing.listing_pda),
  ];
  writeStoredListings(next);
}

export function updateLocalListing(
  id: string,
  updates: Partial<Pick<DbListing, 'status' | 'buyer_wallet' | 'listing_pda' | 'images' | 'metadata_hash'>>
): DbListing | null {
  const listings = readStoredListings();
  const existing = listings.find((item) => item.id === id);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
  };
  writeStoredListings(listings.map((item) => (item.id === id ? updated : item)));
  return updated;
}

export function getFallbackListings(filters: ListingFilters = {}): DbListing[] {
  return filterListings([...readStoredListings(), ...DEMO_LISTINGS], filters);
}

export function getFallbackListing(id: string): DbListing | null {
  return [...readStoredListings(), ...DEMO_LISTINGS].find((listing) => listing.id === id) ?? null;
}

export function getFallbackShipping(listingId: string): DbShipping | null {
  return readStoredShipping().find((record) => record.listing_id === listingId) ?? null;
}

export function saveLocalShipping(
  listingId: string,
  input: Pick<DbShipping, 'tracking_number' | 'carrier' | 'shipped_at' | 'delivered_at'>
): DbShipping {
  const records = readStoredShipping();
  const existing = records.find((record) => record.listing_id === listingId);
  const now = new Date().toISOString();
  const nextRecord: DbShipping = {
    id: existing?.id ?? `local-shipping-${listingId}`,
    listing_id: listingId,
    tracking_number: input.tracking_number,
    carrier: input.carrier,
    shipped_at: input.shipped_at,
    delivered_at: input.delivered_at,
    created_at: existing?.created_at ?? now,
  };

  writeStoredShipping([
    nextRecord,
    ...records.filter((record) => record.listing_id !== listingId),
  ]);

  return nextRecord;
}

export function filterListings(listings: DbListing[], filters: ListingFilters = {}): DbListing[] {
  const filtered = listings.filter((listing) => {
    if (filters.status && listing.status !== filters.status) return false;
    if (filters.event && listing.event_name !== filters.event) return false;
    if (filters.category && listing.category !== filters.category) return false;
    if (filters.condition && listing.condition !== filters.condition) return false;
    if (filters.seller && listing.seller_wallet !== filters.seller) return false;
    if (filters.buyer && listing.buyer_wallet !== filters.buyer) return false;
    if (filters.search) {
      const query = filters.search.toLowerCase();
      const haystack = `${listing.title} ${listing.description ?? ''}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const offset = filters.offset ?? 0;
  const limit = filters.limit ?? filtered.length;
  return filtered.slice(offset, offset + limit);
}
