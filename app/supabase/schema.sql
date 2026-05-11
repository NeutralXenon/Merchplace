-- ============================================
-- Merchplace Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Users (wallet-based, populated on first login)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    wallet_address TEXT PRIMARY KEY,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Listings (off-chain metadata linked to on-chain PDA)
-- ============================================
CREATE TABLE IF NOT EXISTS listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_wallet TEXT NOT NULL REFERENCES users(wallet_address),
    listing_pda TEXT UNIQUE,
    listing_id BIGINT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_name TEXT NOT NULL,
    category TEXT NOT NULL,
    condition TEXT NOT NULL,
    size TEXT,
    price_usdc BIGINT NOT NULL,         -- in USDC smallest unit (6 decimals)
    shipping_cost BIGINT NOT NULL DEFAULT 0,
    shipping_method TEXT,
    images TEXT[] DEFAULT '{}',          -- Array of Supabase Storage URLs
    status TEXT NOT NULL DEFAULT 'available',
    buyer_wallet TEXT REFERENCES users(wallet_address),
    metadata_hash TEXT,                  -- hex-encoded SHA-256 of off-chain metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_status CHECK (status IN ('available', 'in_escrow', 'sold', 'cancelled')),
    CONSTRAINT unique_seller_listing UNIQUE (seller_wallet, listing_id)
);

-- Migration for existing local/dev Supabase projects created before carrier methods.
ALTER TABLE listings
    ADD COLUMN IF NOT EXISTS shipping_method TEXT;

-- ============================================
-- Shipping tracking
-- ============================================
CREATE TABLE IF NOT EXISTS shipping (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    tracking_number TEXT,
    carrier TEXT,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Listing event log (auditable mirror of on-chain actions)
-- ============================================
CREATE TABLE IF NOT EXISTS listing_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    listing_pda TEXT NOT NULL,
    tx_signature TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    actor_wallet TEXT NOT NULL REFERENCES users(wallet_address),
    from_status TEXT,
    to_status TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT valid_event_type CHECK (
        event_type IN (
            'listing_created',
            'purchase_started',
            'receipt_confirmed',
            'purchase_cancelled',
            'listing_cancelled'
        )
    )
);

-- ============================================
-- Indexes for common queries
-- ============================================
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_wallet);
CREATE INDEX IF NOT EXISTS idx_listings_buyer ON listings(buyer_wallet);
CREATE INDEX IF NOT EXISTS idx_listings_event ON listings(event_name);
CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
CREATE INDEX IF NOT EXISTS idx_listings_created ON listings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipping_listing ON shipping(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_events_listing ON listing_events(listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_events_actor ON listing_events(actor_wallet);
CREATE INDEX IF NOT EXISTS idx_listing_events_created ON listing_events(created_at DESC);

-- ============================================
-- Row Level Security (RLS)
-- ============================================
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping ENABLE ROW LEVEL SECURITY;
ALTER TABLE listing_events ENABLE ROW LEVEL SECURITY;

-- Public read access to listings
CREATE POLICY "Listings are viewable by everyone"
    ON listings FOR SELECT
    USING (true);

-- Public read access to users (display name, avatar)
CREATE POLICY "User profiles are viewable by everyone"
    ON users FOR SELECT
    USING (true);

-- Listings can be inserted by the API (service role)
CREATE POLICY "Service role can insert listings"
    ON listings FOR INSERT TO service_role
    WITH CHECK (true);

-- Listings can be updated by the API (service role)
CREATE POLICY "Service role can update listings"
    ON listings FOR UPDATE TO service_role
    USING (true)
    WITH CHECK (true);

-- Users can be inserted by the API (service role)
CREATE POLICY "Service role can insert users"
    ON users FOR INSERT TO service_role
    WITH CHECK (true);

-- Users can be updated by the API (service role)
CREATE POLICY "Service role can update users"
    ON users FOR UPDATE TO service_role
    USING (true)
    WITH CHECK (true);

-- Shipping managed by the API (service role)
CREATE POLICY "Service role can manage shipping"
    ON shipping FOR ALL TO service_role
    USING (true)
    WITH CHECK (true);

-- Event log is public read, service role write
CREATE POLICY "Listing events are viewable by everyone"
    ON listing_events FOR SELECT
    USING (true);

CREATE POLICY "Service role can insert listing events"
    ON listing_events FOR INSERT TO service_role
    WITH CHECK (true);

-- ============================================
-- Storage bucket for listing images
-- ============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'listing-images',
    'listing-images',
    true,
    5242880,
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================
-- Updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER FUNCTION update_updated_at() SET search_path = public;

DROP TRIGGER IF EXISTS listings_updated_at ON listings;
CREATE TRIGGER listings_updated_at
    BEFORE UPDATE ON listings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
