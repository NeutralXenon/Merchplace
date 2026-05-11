use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::MerchplaceError;
use crate::state::{Listing, ListingStatus};
use crate::{BPS_DENOMINATOR, PLATFORM_FEE_BPS};

#[derive(Accounts)]
pub struct CancelPurchase<'info> {
    /// The buyer requesting a cancellation/refund.
    #[account(
        mut,
        constraint = buyer.key() == listing.buyer @ MerchplaceError::UnauthorizedBuyer,
    )]
    pub buyer: Signer<'info>,

    /// The listing PDA — must be in InEscrow status.
    #[account(
        mut,
        seeds = [b"listing", listing.seller.as_ref(), &listing.listing_id.to_le_bytes()],
        bump = listing.listing_bump,
        constraint = listing.status == ListingStatus::InEscrow @ MerchplaceError::ListingNotInEscrow,
    )]
    pub listing: Account<'info, Listing>,

    /// The USDC mint.
    #[account(
        constraint = usdc_mint.key() == listing.usdc_mint @ MerchplaceError::InvalidUsdcMint,
    )]
    pub usdc_mint: Account<'info, Mint>,

    /// The escrow vault PDA (source — returns USDC to buyer).
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = listing,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    /// The buyer's USDC token account (receives refund).
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<CancelPurchase>) -> Result<()> {
    let listing = &ctx.accounts.listing;

    // Calculate total refund (same as total paid: price + shipping + platform fee)
    let platform_fee = listing
        .price
        .checked_mul(PLATFORM_FEE_BPS)
        .ok_or(MerchplaceError::ArithmeticOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(MerchplaceError::ArithmeticOverflow)?;

    let total_refund = listing
        .price
        .checked_add(listing.shipping_cost)
        .ok_or(MerchplaceError::ArithmeticOverflow)?
        .checked_add(platform_fee)
        .ok_or(MerchplaceError::ArithmeticOverflow)?;

    // Build PDA signer seeds
    let seller_key = listing.seller;
    let listing_id_bytes = listing.listing_id.to_le_bytes();
    let bump = [listing.listing_bump];
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"listing",
        seller_key.as_ref(),
        listing_id_bytes.as_ref(),
        &bump,
    ]];

    // Transfer full amount back to buyer
    let cpi_accounts = Transfer {
        from: ctx.accounts.escrow_vault.to_account_info(),
        to: ctx.accounts.buyer_token_account.to_account_info(),
        authority: ctx.accounts.listing.to_account_info(),
    };
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts,
        signer_seeds,
    );
    token::transfer(cpi_ctx, total_refund)?;

    // Reset listing back to Available
    let listing = &mut ctx.accounts.listing;
    listing.buyer = Pubkey::default();
    listing.status = ListingStatus::Available;
    listing.escrow_funded_at = 0;

    msg!("Purchase cancelled: refund={} USDC", total_refund);

    Ok(())
}
