import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getSessionWallet } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import {
  ListingVerificationError,
  verifyPublishedListingOnChain,
} from '@/lib/listingVerification';
import { getShippingMethod, getShippingMethodByPrice } from '@/lib/shippingMethods';
import { createServerClient, DbListing } from '@/lib/supabase';

type CreateListingBody = Partial<
  Pick<
    DbListing,
    | 'seller_wallet'
    | 'listing_id'
    | 'listing_pda'
    | 'title'
    | 'description'
    | 'event_name'
    | 'category'
    | 'condition'
    | 'size'
    | 'price_usdc'
    | 'shipping_cost'
    | 'shipping_method'
    | 'images'
    | 'metadata_hash'
  >
> & {
  tx_signature?: string;
};

/**
 * GET /api/listings
 * Fetch listings with optional filters.
 *
 * Query params:
 * - status: filter by status (default: 'available')
 * - event: filter by event_name
 * - category: filter by category
 * - condition: filter by condition
 * - search: text search on title
 * - seller: filter by seller_wallet
 * - buyer: filter by buyer_wallet
 * - limit: number of results (default: 50)
 * - offset: pagination offset (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);

    const status = searchParams.get('status');
    const event = searchParams.get('event');
    const category = searchParams.get('category');
    const condition = searchParams.get('condition');
    const search = searchParams.get('search');
    const seller = searchParams.get('seller');
    const buyer = searchParams.get('buyer');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = supabase
      .from('listings')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (status) query = query.eq('status', status);
    if (event) query = query.eq('event_name', event);
    if (category) query = query.eq('category', category);
    if (condition) query = query.eq('condition', condition);
    if (seller) query = query.eq('seller_wallet', seller);
    if (buyer) query = query.eq('buyer_wallet', buyer);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      listings: data as DbListing[],
      total: count ?? 0,
      limit,
      offset,
    });
  } catch (err: unknown) {
    console.error('GET /api/listings error:', err);
    return NextResponse.json(
      { error: getErrorMessage(err, 'Internal server error') },
      { status: 500 }
    );
  }
}

/**
 * POST /api/listings
 * Create a new listing.
 *
 * Body (JSON):
 * - seller_wallet: string (required)
 * - listing_id: number (required, unique per seller)
 * - title: string (required)
 * - description: string
 * - event_name: string (required)
 * - category: string (required)
 * - condition: string (required)
 * - size: string
 * - price_usdc: number (required, in smallest unit)
 * - shipping_cost: number (required, from the selected carrier method)
 * - shipping_method: string (required carrier method id)
 * - images: string[] (array of image URLs)
 * - listing_pda: string (on-chain PDA address)
 * - metadata_hash: string (hex-encoded SHA-256)
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateListingBody;

    // Validate required fields
    const required: Array<keyof CreateListingBody> = [
      'seller_wallet',
      'listing_id',
      'title',
      'event_name',
      'category',
      'condition',
      'price_usdc',
      'shipping_cost',
      'shipping_method',
      'metadata_hash',
      'listing_pda',
      'tx_signature',
    ];
    for (const field of required) {
      if (!body[field] && body[field] !== 0) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }

    const sellerWallet = body.seller_wallet;
    const listingId = body.listing_id;
    const title = body.title;
    const eventName = body.event_name;
    const category = body.category;
    const condition = body.condition;
    const priceUsdc = body.price_usdc;
    const shippingCost = body.shipping_cost ?? 0;
    const shippingMethod =
      getShippingMethod(body.shipping_method) ?? getShippingMethodByPrice(shippingCost);

    if (
      typeof sellerWallet !== 'string' ||
      typeof title !== 'string' ||
      typeof eventName !== 'string' ||
      typeof category !== 'string' ||
      typeof condition !== 'string' ||
      typeof listingId !== 'number' ||
      typeof priceUsdc !== 'number' ||
      typeof shippingCost !== 'number' ||
      typeof body.metadata_hash !== 'string' ||
      typeof body.listing_pda !== 'string' ||
      typeof body.tx_signature !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Invalid listing payload' },
        { status: 400 }
      );
    }

    try {
      new PublicKey(sellerWallet);
    } catch {
      return NextResponse.json({ error: 'Invalid seller wallet' }, { status: 400 });
    }

    const sessionWallet = getSessionWallet(request);
    if (!sessionWallet || sessionWallet !== sellerWallet) {
      return NextResponse.json(
        { error: 'Wallet session required for this seller' },
        { status: 401 }
      );
    }

    if (priceUsdc <= 0) {
      return NextResponse.json(
        { error: 'Price must be greater than zero' },
        { status: 400 }
      );
    }

    if (!shippingMethod || shippingMethod.priceMicro !== shippingCost) {
      return NextResponse.json(
        { error: 'Choose a valid carrier shipping method' },
        { status: 400 }
      );
    }

    try {
      await verifyPublishedListingOnChain({
        txSignature: body.tx_signature,
        payload: {
          sellerWallet,
          listingPda: body.listing_pda,
          listingId,
          priceUsdc,
          shippingCost,
          metadataHash: body.metadata_hash,
        },
      });
    } catch (err: unknown) {
      if (err instanceof ListingVerificationError) {
        return NextResponse.json(
          { error: err.message },
          { status: 409 }
        );
      }

      throw err;
    }

    const supabase = createServerClient();

    // Ensure seller user exists (upsert)
    await supabase
      .from('users')
      .upsert(
        { wallet_address: sellerWallet },
        { onConflict: 'wallet_address' }
      );

    // Create listing
    const { data, error } = await supabase
      .from('listings')
      .insert({
        seller_wallet: sellerWallet,
        listing_id: listingId,
        listing_pda: body.listing_pda,
        title,
        description: body.description || null,
        event_name: eventName,
        category,
        condition,
        size: body.size || null,
        price_usdc: priceUsdc,
        shipping_cost: shippingCost,
        shipping_method: shippingMethod.id,
        images: body.images || [],
        metadata_hash: body.metadata_hash,
        status: 'available',
      })
      .select()
      .single();

    if (error) {
      console.error('Insert listing error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { error: eventError } = await supabase.from('listing_events').insert({
      listing_id: data.id,
      listing_pda: body.listing_pda,
      tx_signature: body.tx_signature,
      event_type: 'listing_created',
      actor_wallet: sellerWallet,
      from_status: null,
      to_status: 'available',
    });

    if (eventError) {
      console.error('Insert listing event error:', eventError);
    }

    return NextResponse.json({ listing: data }, { status: 201 });
  } catch (err: unknown) {
    console.error('POST /api/listings error:', err);
    return NextResponse.json(
      { error: getErrorMessage(err, 'Internal server error') },
      { status: 500 }
    );
  }
}
