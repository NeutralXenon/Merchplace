import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Server-side Supabase client using the service role key.
 * Use this in API routes — bypasses RLS for write operations.
 */
export function createServerClient() {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY'
    );
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

/**
 * Client-side Supabase client using the anon key.
 * Use this in browser components — respects RLS policies.
 */
export function createBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY'
    );
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

/** Type definitions matching the database schema */
export type DbListing = {
  id: string;
  seller_wallet: string;
  listing_pda: string | null;
  listing_id: number;
  title: string;
  description: string | null;
  event_name: string;
  category: string;
  condition: string;
  size: string | null;
  price_usdc: number;
  shipping_cost: number;
  shipping_method?: string | null;
  images: string[];
  status: 'available' | 'in_escrow' | 'sold' | 'cancelled';
  buyer_wallet: string | null;
  metadata_hash: string | null;
  created_at: string;
  updated_at: string;
};

export type DbShipping = {
  id: string;
  listing_id: string;
  tracking_number: string | null;
  carrier: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
};

export type DbUser = {
  wallet_address: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type DbListingEvent = {
  id: string;
  listing_id: string;
  listing_pda: string;
  tx_signature: string;
  event_type:
    | 'listing_created'
    | 'purchase_started'
    | 'receipt_confirmed'
    | 'purchase_cancelled'
    | 'listing_cancelled';
  actor_wallet: string;
  from_status: DbListing['status'] | null;
  to_status: DbListing['status'] | null;
  created_at: string;
};
