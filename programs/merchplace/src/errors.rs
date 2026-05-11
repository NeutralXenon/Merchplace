use anchor_lang::prelude::*;

#[error_code]
pub enum MerchplaceError {
    #[msg("Price must be greater than zero")]
    InvalidPrice,

    #[msg("Listing is not available for purchase")]
    ListingNotAvailable,

    #[msg("Listing is not in escrow")]
    ListingNotInEscrow,

    #[msg("Only the buyer can perform this action")]
    UnauthorizedBuyer,

    #[msg("Only the seller can perform this action")]
    UnauthorizedSeller,

    #[msg("Cannot buy your own listing")]
    CannotBuyOwnListing,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    #[msg("Listing has already been purchased and cannot be cancelled")]
    ListingAlreadySold,

    #[msg("Invalid USDC mint address")]
    InvalidUsdcMint,
}
