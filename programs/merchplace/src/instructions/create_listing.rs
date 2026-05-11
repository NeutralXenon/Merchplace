use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::errors::MerchplaceError;
use crate::state::{Listing, ListingStatus};

#[derive(Accounts)]
#[instruction(listing_id: u64)]
pub struct CreateListing<'info> {
    /// The seller creating the listing.
    #[account(mut)]
    pub seller: Signer<'info>,

    /// The listing PDA — stores all on-chain listing data.
    #[account(
        init,
        payer = seller,
        space = 8 + Listing::INIT_SPACE,
        seeds = [b"listing", seller.key().as_ref(), &listing_id.to_le_bytes()],
        bump,
    )]
    pub listing: Account<'info, Listing>,

    /// The USDC mint account (validated by the caller).
    pub usdc_mint: Account<'info, Mint>,

    /// The escrow vault — a PDA-owned token account that will hold buyer's USDC.
    #[account(
        init,
        payer = seller,
        associated_token::mint = usdc_mint,
        associated_token::authority = listing,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateListing>,
    listing_id: u64,
    price: u64,
    metadata_hash: [u8; 32],
    shipping_cost: u64,
) -> Result<()> {
    require!(price > 0, MerchplaceError::InvalidPrice);

    let listing = &mut ctx.accounts.listing;
    listing.seller = ctx.accounts.seller.key();
    listing.buyer = Pubkey::default();
    listing.price = price;
    listing.shipping_cost = shipping_cost;
    listing.metadata_hash = metadata_hash;
    listing.listing_id = listing_id;
    listing.status = ListingStatus::Available;
    listing.created_at = Clock::get()?.unix_timestamp;
    listing.escrow_funded_at = 0;
    listing.listing_bump = ctx.bumps.listing;
    listing.escrow_bump = 0; // ATA doesn't use a custom bump
    listing.usdc_mint = ctx.accounts.usdc_mint.key();

    msg!(
        "Listing created: id={}, price={} USDC, shipping={} USDC",
        listing_id,
        price,
        shipping_cost,
    );

    Ok(())
}
