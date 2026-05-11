use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::MerchplaceError;
use crate::state::{Listing, ListingStatus};
use crate::{BPS_DENOMINATOR, PLATFORM_FEE_BPS};

#[derive(Accounts)]
pub struct BuyItem<'info> {
    /// The buyer purchasing the item.
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// The listing PDA — must be in Available status.
    #[account(
        mut,
        seeds = [b"listing", listing.seller.as_ref(), &listing.listing_id.to_le_bytes()],
        bump = listing.listing_bump,
        constraint = listing.status == ListingStatus::Available @ MerchplaceError::ListingNotAvailable,
        constraint = listing.seller != buyer.key() @ MerchplaceError::CannotBuyOwnListing,
    )]
    pub listing: Account<'info, Listing>,

    /// The USDC mint.
    #[account(
        constraint = usdc_mint.key() == listing.usdc_mint @ MerchplaceError::InvalidUsdcMint,
    )]
    pub usdc_mint: Account<'info, Mint>,

    /// The buyer's USDC token account (source of funds).
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,

    /// The escrow vault PDA token account (destination for buyer's USDC).
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = listing,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<BuyItem>) -> Result<()> {
    let listing = &ctx.accounts.listing;

    // Calculate total payment: price + shipping + platform fee
    let platform_fee = listing
        .price
        .checked_mul(PLATFORM_FEE_BPS)
        .ok_or(MerchplaceError::ArithmeticOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(MerchplaceError::ArithmeticOverflow)?;

    let total_amount = listing
        .price
        .checked_add(listing.shipping_cost)
        .ok_or(MerchplaceError::ArithmeticOverflow)?
        .checked_add(platform_fee)
        .ok_or(MerchplaceError::ArithmeticOverflow)?;

    // Transfer USDC from buyer to escrow vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.buyer_token_account.to_account_info(),
        to: ctx.accounts.escrow_vault.to_account_info(),
        authority: ctx.accounts.buyer.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), cpi_accounts);
    token::transfer(cpi_ctx, total_amount)?;

    // Update listing state
    let listing = &mut ctx.accounts.listing;
    listing.buyer = ctx.accounts.buyer.key();
    listing.status = ListingStatus::InEscrow;
    listing.escrow_funded_at = Clock::get()?.unix_timestamp;

    msg!(
        "Item purchased: price={}, shipping={}, fee={}, total={}",
        listing.price,
        listing.shipping_cost,
        platform_fee,
        total_amount,
    );

    Ok(())
}
