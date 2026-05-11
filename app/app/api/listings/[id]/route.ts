import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getSessionWallet } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import {
  ListingVerificationError,
  verifyListingTransitionOnChain,
} from '@/lib/listingVerification';
import { createServerClient } from '@/lib/supabase';
import type { DbListing } from '@/lib/supabase';

type ListingUpdates = Partial<
  Pick<DbListing, 'status' | 'buyer_wallet' | 'listing_pda' | 'images' | 'metadata_hash'>
> & {
  tx_signature?: string;
};

function getEventType(
  fromStatus: DbListing['status'],
  toStatus: DbListing['status'] | undefined
) {
  if (fromStatus === 'available' && toStatus === 'in_escrow') return 'purchase_started';
  if (fromStatus === 'in_escrow' && toStatus === 'sold') return 'receipt_confirmed';
  if (fromStatus === 'in_escrow' && toStatus === 'available') return 'purchase_cancelled';
  if (toStatus === 'cancelled') return 'listing_cancelled';
  return null;
}

function getTransitionBuyerWallet(
  currentListing: DbListing,
  updates: ListingUpdates
): string | null | undefined {
  if (updates.status === 'in_escrow') return updates.buyer_wallet;
  if (updates.status === 'available') return updates.buyer_wallet ?? null;
  return currentListing.buyer_wallet;
}

/**
 * GET /api/listings/[id]
 * Fetch a single listing by UUID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ listing: data });
  } catch (err: unknown) {
    console.error('GET /api/listings/[id] error:', err);
    return NextResponse.json(
      { error: getErrorMessage(err, 'Internal server error') },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/listings/[id]
 * Update listing status or metadata.
 *
 * Body (JSON):
 * - status: 'available' | 'in_escrow' | 'sold' | 'cancelled'
 * - buyer_wallet: string (set when purchased)
 * - listing_pda: string (set after on-chain creation)
 * - images: string[] (update images)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createServerClient();
    const body = (await request.json()) as ListingUpdates;
    const sessionWallet = getSessionWallet(request);
    if (!sessionWallet) {
      return NextResponse.json({ error: 'Wallet session required' }, { status: 401 });
    }

    const { data: existing, error: fetchError } = await supabase
      .from('listings')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const currentListing = existing as DbListing;

    // Only allow updating specific fields
    const updates: ListingUpdates = {};
    if (body.status !== undefined) updates.status = body.status;
    if (body.buyer_wallet !== undefined) updates.buyer_wallet = body.buyer_wallet;
    if (body.listing_pda !== undefined) updates.listing_pda = body.listing_pda;
    if (body.images !== undefined) updates.images = body.images;
    if (body.metadata_hash !== undefined) updates.metadata_hash = body.metadata_hash;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const eventType = getEventType(currentListing.status, updates.status);
    if (eventType && typeof body.tx_signature !== 'string') {
      return NextResponse.json(
        { error: 'Missing tx_signature for status update' },
        { status: 400 }
      );
    }

    if (updates.buyer_wallet) {
      try {
        new PublicKey(updates.buyer_wallet);
      } catch {
        return NextResponse.json({ error: 'Invalid buyer wallet' }, { status: 400 });
      }
    }

    const sessionIsSeller = sessionWallet === currentListing.seller_wallet;
    const sessionIsBuyer = sessionWallet === currentListing.buyer_wallet;
    const purchasingAsBuyer =
      updates.status === 'in_escrow' &&
      updates.buyer_wallet === sessionWallet &&
      currentListing.status === 'available';
    const confirmingReceipt = updates.status === 'sold' && sessionIsBuyer;
    const cancellingPurchase =
      updates.status === 'available' &&
      updates.buyer_wallet === null &&
      sessionIsBuyer;
    const cancellingListing = updates.status === 'cancelled' && sessionIsSeller;
    const sellerMetadataUpdate =
      sessionIsSeller &&
      updates.status === undefined &&
      updates.buyer_wallet === undefined;

    if (
      !purchasingAsBuyer &&
      !confirmingReceipt &&
      !cancellingPurchase &&
      !cancellingListing &&
      !sellerMetadataUpdate
    ) {
      return NextResponse.json(
        { error: 'Wallet session is not authorized for this listing update' },
        { status: 403 }
      );
    }

    if (eventType && updates.status && body.tx_signature) {
      if (!currentListing.listing_pda || !currentListing.metadata_hash) {
        return NextResponse.json(
          { error: 'Listing is missing on-chain verification fields' },
          { status: 409 }
        );
      }

      try {
        await verifyListingTransitionOnChain({
          txSignature: body.tx_signature,
          payload: {
            sellerWallet: currentListing.seller_wallet,
            listingPda: currentListing.listing_pda,
            listingId: currentListing.listing_id,
            priceUsdc: currentListing.price_usdc,
            shippingCost: currentListing.shipping_cost,
            metadataHash: currentListing.metadata_hash,
          },
          transition: {
            fromStatus: currentListing.status,
            toStatus: updates.status,
            actorWallet: sessionWallet,
            buyerWallet: getTransitionBuyerWallet(currentListing, updates),
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
    }

    // If setting a buyer, upsert user
    if (updates.buyer_wallet) {
      await supabase
        .from('users')
        .upsert(
          { wallet_address: updates.buyer_wallet },
          { onConflict: 'wallet_address' }
        );
    }

    const { data, error } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update listing error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Listing not found' },
        { status: 404 }
      );
    }

    if (eventType && body.tx_signature) {
      const listingPda = updates.listing_pda || currentListing.listing_pda;
      if (listingPda) {
        const { error: eventError } = await supabase.from('listing_events').insert({
          listing_id: id,
          listing_pda: listingPda,
          tx_signature: body.tx_signature,
          event_type: eventType,
          actor_wallet: sessionWallet,
          from_status: currentListing.status,
          to_status: updates.status,
        });

        if (eventError) {
          console.error('Insert listing event error:', eventError);
        }
      }
    }

    return NextResponse.json({ listing: data });
  } catch (err: unknown) {
    console.error('PATCH /api/listings/[id] error:', err);
    return NextResponse.json(
      { error: getErrorMessage(err, 'Internal server error') },
      { status: 500 }
    );
  }
}
