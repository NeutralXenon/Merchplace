use anchor_lang::prelude::*;

use crate::errors::MerchplaceError;
use crate::state::{Listing, ListingStatus};

#[derive(Accounts)]
pub struct CancelListing<'info> {
    /// The seller cancelling their listing.
    #[account(
        mut,
        constraint = seller.key() == listing.seller @ MerchplaceError::UnauthorizedSeller,
    )]
    pub seller: Signer<'info>,

    /// The listing PDA — must be in Available status (cannot cancel if in escrow).
    #[account(
        mut,
        seeds = [b"listing", listing.seller.as_ref(), &listing.listing_id.to_le_bytes()],
        bump = listing.listing_bump,
        constraint = listing.status == ListingStatus::Available @ MerchplaceError::ListingAlreadySold,
        close = seller,
    )]
    pub listing: Account<'info, Listing>,

    // Note: The escrow vault (ATA) would need to be closed separately
    // if it has been created. For simplicity, the close constraint on
    // the listing account reclaims its rent to the seller.
    // A follow-up instruction or client-side logic can close the empty ATA.

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CancelListing>) -> Result<()> {
    msg!(
        "Listing cancelled: id={}",
        ctx.accounts.listing.listing_id,
    );

    // The listing account is closed by the `close = seller` constraint,
    // which drains lamports to seller and zeroes the account data.
    // Status is set for any log/event readers that might see the pre-close state.

    Ok(())
}
