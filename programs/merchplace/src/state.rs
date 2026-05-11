use anchor_lang::prelude::*;

/// Represents the status of a marketplace listing.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum ListingStatus {
    /// Listing is active and available for purchase.
    Available,
    /// A buyer has deposited funds into escrow; awaiting delivery confirmation.
    InEscrow,
    /// Buyer confirmed receipt; escrow has been released to seller.
    Completed,
    /// Listing was cancelled (by seller before sale, or by buyer before shipment).
    Cancelled,
}

/// On-chain listing account that tracks a marketplace item.
///
/// PDA seeds: [b"listing", seller.key(), listing_id.to_le_bytes()]
#[account]
#[derive(InitSpace)]
pub struct Listing {
    /// The seller's wallet address.
    pub seller: Pubkey,
    /// The buyer's wallet address (set when purchased).
    pub buyer: Pubkey,
    /// Price of the item in USDC (6 decimals, e.g., 10_000_000 = 10 USDC).
    pub price: u64,
    /// Shipping cost in USDC (6 decimals). Paid by the buyer.
    pub shipping_cost: u64,
    /// SHA-256 hash of the off-chain metadata (title, description, images, etc.).
    pub metadata_hash: [u8; 32],
    /// Unique listing identifier (per seller).
    pub listing_id: u64,
    /// Current status of the listing.
    pub status: ListingStatus,
    /// Unix timestamp when the listing was created.
    pub created_at: i64,
    /// Unix timestamp when escrow was funded (for timeout logic).
    pub escrow_funded_at: i64,
    /// Bump seed for the listing PDA.
    pub listing_bump: u8,
    /// Bump seed for the escrow vault PDA.
    pub escrow_bump: u8,
    /// The USDC mint address this listing uses.
    pub usdc_mint: Pubkey,
}
