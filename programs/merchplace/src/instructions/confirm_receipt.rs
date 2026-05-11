use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::errors::MerchplaceError;
use crate::state::{Listing, ListingStatus};
use crate::{BPS_DENOMINATOR, PLATFORM_FEE_BPS};

#[derive(Accounts)]
pub struct ConfirmReceipt<'info> {
    /// The buyer confirming they received the item.
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

    /// The escrow vault PDA (source — releases USDC).
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = listing,
    )]
    pub escrow_vault: Account<'info, TokenAccount>,

    /// The seller's USDC token account (receives item price + shipping cost).
    /// CHECK: We verify the seller address matches the listing.
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = seller,
    )]
    pub seller_token_account: Account<'info, TokenAccount>,

    /// The seller wallet (for ATA derivation).
    /// CHECK: Validated by constraint on listing.seller.
    #[account(
        constraint = seller.key() == listing.seller @ MerchplaceError::UnauthorizedSeller,
    )]
    pub seller: SystemAccount<'info>,

    /// The platform treasury USDC token account (receives the 5% fee).
    #[account(
        mut,
        token::mint = usdc_mint,
    )]
    pub treasury_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<ConfirmReceipt>) -> Result<()> {
    let listing = &ctx.accounts.listing;

    // Calculate the platform fee
    let platform_fee = listing
        .price
        .checked_mul(PLATFORM_FEE_BPS)
        .ok_or(MerchplaceError::ArithmeticOverflow)?
        .checked_div(BPS_DENOMINATOR)
        .ok_or(MerchplaceError::ArithmeticOverflow)?;

    // Seller receives: item price + shipping cost
    let seller_amount = listing
        .price
        .checked_add(listing.shipping_cost)
        .ok_or(MerchplaceError::ArithmeticOverflow)?;

    // Build PDA signer seeds for the listing (escrow vault authority)
    let seller_key = listing.seller;
    let listing_id_bytes = listing.listing_id.to_le_bytes();
    let bump = [listing.listing_bump];
    let signer_seeds: &[&[&[u8]]] = &[&[
        b"listing",
        seller_key.as_ref(),
        listing_id_bytes.as_ref(),
        &bump,
    ]];

    // 1. Transfer seller_amount (price + shipping) to seller
    let cpi_accounts_seller = Transfer {
        from: ctx.accounts.escrow_vault.to_account_info(),
        to: ctx.accounts.seller_token_account.to_account_info(),
        authority: ctx.accounts.listing.to_account_info(),
    };
    let cpi_ctx_seller = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts_seller,
        signer_seeds,
    );
    token::transfer(cpi_ctx_seller, seller_amount)?;

    // 2. Transfer platform fee to treasury
    let cpi_accounts_treasury = Transfer {
        from: ctx.accounts.escrow_vault.to_account_info(),
        to: ctx.accounts.treasury_token_account.to_account_info(),
        authority: ctx.accounts.listing.to_account_info(),
    };
    let cpi_ctx_treasury = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),
        cpi_accounts_treasury,
        signer_seeds,
    );
    token::transfer(cpi_ctx_treasury, platform_fee)?;

    // Update listing state
    let listing = &mut ctx.accounts.listing;
    listing.status = ListingStatus::Completed;

    msg!(
        "Receipt confirmed: seller_receives={}, treasury_fee={}",
        seller_amount,
        platform_fee,
    );

    Ok(())
}
