import { NextRequest, NextResponse } from 'next/server';
import { getSessionWallet } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { createServerClient } from '@/lib/supabase';
import type { DbListing, DbShipping } from '@/lib/supabase';

type ShippingBody = Partial<
  Pick<DbShipping, 'tracking_number' | 'carrier' | 'shipped_at' | 'delivered_at'>
>;

function readText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readOptionalIsoDate(value: unknown): string | null {
  const text = readText(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function findListing(id: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .single();

  return { supabase, listing: error || !data ? null : (data as DbListing) };
}

/**
 * GET /api/listings/[id]/shipping
 * Fetch the shipment record for a listing.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { supabase, listing } = await findListing(id);

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('shipping')
      .select('*')
      .eq('listing_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ shipping: data ?? null });
  } catch (err: unknown) {
    console.error('GET /api/listings/[id]/shipping error:', err);
    return NextResponse.json(
      { error: getErrorMessage(err, 'Internal server error') },
      { status: 500 }
    );
  }
}

/**
 * POST /api/listings/[id]/shipping
 * Create or update shipment tracking for an in-escrow listing.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sessionWallet = getSessionWallet(request);

    if (!sessionWallet) {
      return NextResponse.json({ error: 'Wallet session required' }, { status: 401 });
    }

    const { supabase, listing } = await findListing(id);

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    if (sessionWallet !== listing.seller_wallet) {
      return NextResponse.json(
        { error: 'Only the seller can update shipping' },
        { status: 403 }
      );
    }

    if (listing.status !== 'in_escrow') {
      return NextResponse.json(
        { error: 'Shipping can only be updated while the listing is in escrow' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as ShippingBody;
    const trackingNumber = readText(body.tracking_number);
    const carrier = readText(body.carrier);

    if (!trackingNumber || !carrier) {
      return NextResponse.json(
        { error: 'Carrier and tracking number are required' },
        { status: 400 }
      );
    }

    const shipment = {
      listing_id: id,
      tracking_number: trackingNumber,
      carrier,
      shipped_at: readOptionalIsoDate(body.shipped_at) ?? new Date().toISOString(),
      delivered_at: readOptionalIsoDate(body.delivered_at),
    };

    const { data: existing, error: findError } = await supabase
      .from('shipping')
      .select('id')
      .eq('listing_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    const query = existing?.id
      ? supabase
          .from('shipping')
          .update(shipment)
          .eq('id', existing.id)
          .select()
          .single()
      : supabase
          .from('shipping')
          .insert(shipment)
          .select()
          .single();

    const { data, error } = await query;

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || 'Failed to save shipping' },
        { status: 500 }
      );
    }

    return NextResponse.json({ shipping: data }, { status: existing?.id ? 200 : 201 });
  } catch (err: unknown) {
    console.error('POST /api/listings/[id]/shipping error:', err);
    return NextResponse.json(
      { error: getErrorMessage(err, 'Internal server error') },
      { status: 500 }
    );
  }
}
