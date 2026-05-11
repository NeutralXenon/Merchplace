use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("BWM5Sppg3Qu2mZCGM9ZiwWxDe9st3y4x3rb4Yur7Hauj");

/// Platform fee: 5% (represented as basis points: 500 / 10_000)
pub const PLATFORM_FEE_BPS: u64 = 500;
pub const BPS_DENOMINATOR: u64 = 10_000;

#[program]
pub mod merchplace {
    use super::*;

    /// Seller creates a new listing with a price in USDC.
    /// The listing PDA stores metadata hash, price, and status.
    pub fn create_listing(
        ctx: Context<CreateListing>,
        listing_id: u64,
        price: u64,
        metadata_hash: [u8; 32],
        shipping_cost: u64,
    ) -> Result<()> {
        instructions::create_listing::handler(ctx, listing_id, price, metadata_hash, shipping_cost)
    }

    /// Buyer purchases an item by depositing USDC (price + shipping + platform fee)
    /// into the escrow vault PDA.
    pub fn buy_item(ctx: Context<BuyItem>) -> Result<()> {
        instructions::buy_item::handler(ctx)
    }

    /// Buyer confirms receipt of the item. Escrow releases USDC:
    /// - Item price → seller
    /// - Platform fee → treasury
    /// - Shipping cost was already factored into escrow
    pub fn confirm_receipt(ctx: Context<ConfirmReceipt>) -> Result<()> {
        instructions::confirm_receipt::handler(ctx)
    }

    /// Buyer cancels the purchase before shipment. Full refund from escrow.
    pub fn cancel_purchase(ctx: Context<CancelPurchase>) -> Result<()> {
        instructions::cancel_purchase::handler(ctx)
    }

    /// Seller cancels an unsold listing.
    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        instructions::cancel_listing::handler(ctx)
    }
}
