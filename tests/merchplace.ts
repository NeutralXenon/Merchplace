import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Merchplace } from "../target/types/merchplace";
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { expect } from "chai";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";

describe("merchplace", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.merchplace as Program<Merchplace>;
  const connection = provider.connection;

  // Test actors
  let seller: Keypair;
  let buyer: Keypair;
  let treasury: Keypair;

  // USDC mock
  let usdcMint: PublicKey;
  let mintAuthority: Keypair;
  const USDC_DECIMALS = 6;

  // Token accounts
  let sellerTokenAccount: PublicKey;
  let buyerTokenAccount: PublicKey;
  let treasuryTokenAccount: PublicKey;

  // Listing params
  const listingId = new BN(1);
  const price = new BN(10_000_000); // 10 USDC
  const shippingCost = new BN(2_000_000); // 2 USDC
  const metadataHash = new Uint8Array(32).fill(1); // Mock hash

  // Platform fee: 5% of price = 500_000 (0.5 USDC)
  const platformFee = price
    .mul(new BN(500))
    .div(new BN(10_000));
  const totalBuyerPays = price.add(shippingCost).add(platformFee);

  // PDAs
  let listingPda: PublicKey;
  let listingBump: number;
  let escrowVault: PublicKey;

  before(async () => {
    // Create test wallets
    seller = Keypair.generate();
    buyer = Keypair.generate();
    treasury = Keypair.generate();
    mintAuthority = Keypair.generate();

    // Airdrop SOL to all actors
    for (const kp of [seller, buyer, treasury, mintAuthority]) {
      const sig = await connection.requestAirdrop(
        kp.publicKey,
        2 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(sig);
    }

    // Create mock USDC mint
    usdcMint = await createMint(
      connection,
      seller, // payer
      mintAuthority.publicKey, // mint authority
      null, // freeze authority
      USDC_DECIMALS
    );

    // Create token accounts
    sellerTokenAccount = await createAssociatedTokenAccount(
      connection,
      seller,
      usdcMint,
      seller.publicKey
    );

    buyerTokenAccount = await createAssociatedTokenAccount(
      connection,
      buyer,
      usdcMint,
      buyer.publicKey
    );

    treasuryTokenAccount = await createAssociatedTokenAccount(
      connection,
      treasury,
      usdcMint,
      treasury.publicKey
    );

    // Mint USDC to buyer (100 USDC for testing)
    await mintTo(
      connection,
      buyer,
      usdcMint,
      buyerTokenAccount,
      mintAuthority,
      100_000_000 // 100 USDC
    );

    // Derive listing PDA
    [listingPda, listingBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("listing"),
        seller.publicKey.toBuffer(),
        listingId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    // Derive escrow vault (ATA owned by listing PDA)
    escrowVault = await getAssociatedTokenAddress(
      usdcMint,
      listingPda,
      true // allowOwnerOffCurve (PDA)
    );
  });

  describe("create_listing", () => {
    it("should create a listing successfully", async () => {
      const tx = await program.methods
        .createListing(
          listingId,
          price,
          Array.from(metadataHash),
          shippingCost
        )
        .accounts({
          seller: seller.publicKey,
          listing: listingPda,
          usdcMint: usdcMint,
          escrowVault: escrowVault,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([seller])
        .rpc();

      // Verify listing account data
      const listing = await program.account.listing.fetch(listingPda);
      expect(listing.seller.toBase58()).to.equal(seller.publicKey.toBase58());
      expect(listing.price.toNumber()).to.equal(price.toNumber());
      expect(listing.shippingCost.toNumber()).to.equal(shippingCost.toNumber());
      expect(listing.listingId.toNumber()).to.equal(listingId.toNumber());
      expect(listing.status).to.deep.equal({ available: {} });
      expect(listing.usdcMint.toBase58()).to.equal(usdcMint.toBase58());
      expect(listing.metadataHash).to.deep.equal(Array.from(metadataHash));

      // Verify escrow vault exists and is empty
      const vault = await getAccount(connection, escrowVault);
      expect(Number(vault.amount)).to.equal(0);
    });

    it("should reject zero price", async () => {
      const listingId2 = new BN(99);
      const [pda2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("listing"),
          seller.publicKey.toBuffer(),
          listingId2.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );
      const vault2 = await getAssociatedTokenAddress(usdcMint, pda2, true);

      try {
        await program.methods
          .createListing(listingId2, new BN(0), Array.from(metadataHash), shippingCost)
          .accounts({
            seller: seller.publicKey,
            listing: pda2,
            usdcMint: usdcMint,
            escrowVault: vault2,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([seller])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.toString()).to.include("InvalidPrice");
      }
    });
  });

  describe("buy_item", () => {
    it("should allow buyer to purchase with USDC", async () => {
      const buyerBalanceBefore = (
        await getAccount(connection, buyerTokenAccount)
      ).amount;

      const tx = await program.methods
        .buyItem()
        .accounts({
          buyer: buyer.publicKey,
          listing: listingPda,
          usdcMint: usdcMint,
          buyerTokenAccount: buyerTokenAccount,
          escrowVault: escrowVault,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([buyer])
        .rpc();

      // Verify listing state changed
      const listing = await program.account.listing.fetch(listingPda);
      expect(listing.status).to.deep.equal({ inEscrow: {} });
      expect(listing.buyer.toBase58()).to.equal(buyer.publicKey.toBase58());

      // Verify USDC moved to escrow
      const vault = await getAccount(connection, escrowVault);
      expect(Number(vault.amount)).to.equal(totalBuyerPays.toNumber());

      // Verify buyer's balance decreased
      const buyerBalanceAfter = (
        await getAccount(connection, buyerTokenAccount)
      ).amount;
      expect(Number(buyerBalanceBefore) - Number(buyerBalanceAfter)).to.equal(
        totalBuyerPays.toNumber()
      );
    });

    it("should reject seller buying own listing", async () => {
      // Create a fresh listing for this test
      const lid = new BN(2);
      const [pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("listing"),
          seller.publicKey.toBuffer(),
          lid.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );
      const vault = await getAssociatedTokenAddress(usdcMint, pda, true);

      // First create it
      await program.methods
        .createListing(lid, price, Array.from(metadataHash), shippingCost)
        .accounts({
          seller: seller.publicKey,
          listing: pda,
          usdcMint: usdcMint,
          escrowVault: vault,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([seller])
        .rpc();

      // Seller needs USDC to attempt buying
      await mintTo(
        connection,
        seller,
        usdcMint,
        sellerTokenAccount,
        mintAuthority,
        100_000_000
      );

      // Try to buy own listing
      try {
        await program.methods
          .buyItem()
          .accounts({
            buyer: seller.publicKey,
            listing: pda,
            usdcMint: usdcMint,
            buyerTokenAccount: sellerTokenAccount,
            escrowVault: vault,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([seller])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.toString()).to.include("CannotBuyOwnListing");
      }
    });
  });

  describe("confirm_receipt", () => {
    it("should release escrow to seller and fee to treasury", async () => {
      const sellerBalanceBefore = Number(
        (await getAccount(connection, sellerTokenAccount)).amount
      );
      const treasuryBalanceBefore = Number(
        (await getAccount(connection, treasuryTokenAccount)).amount
      );

      const tx = await program.methods
        .confirmReceipt()
        .accounts({
          buyer: buyer.publicKey,
          listing: listingPda,
          usdcMint: usdcMint,
          escrowVault: escrowVault,
          sellerTokenAccount: sellerTokenAccount,
          seller: seller.publicKey,
          treasuryTokenAccount: treasuryTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([buyer])
        .rpc();

      // Verify listing is completed
      const listing = await program.account.listing.fetch(listingPda);
      expect(listing.status).to.deep.equal({ completed: {} });

      // Verify seller received price + shipping
      const sellerBalanceAfter = Number(
        (await getAccount(connection, sellerTokenAccount)).amount
      );
      const sellerReceived = sellerBalanceAfter - sellerBalanceBefore;
      expect(sellerReceived).to.equal(
        price.add(shippingCost).toNumber()
      );

      // Verify treasury received platform fee
      const treasuryBalanceAfter = Number(
        (await getAccount(connection, treasuryTokenAccount)).amount
      );
      const treasuryReceived = treasuryBalanceAfter - treasuryBalanceBefore;
      expect(treasuryReceived).to.equal(platformFee.toNumber());

      // Verify escrow vault is empty
      const vault = await getAccount(connection, escrowVault);
      expect(Number(vault.amount)).to.equal(0);
    });
  });

  describe("cancel_purchase", () => {
    // We need a new listing to test cancellation
    const cancelListingId = new BN(3);
    let cancelListingPda: PublicKey;
    let cancelEscrowVault: PublicKey;

    before(async () => {
      [cancelListingPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("listing"),
          seller.publicKey.toBuffer(),
          cancelListingId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );
      cancelEscrowVault = await getAssociatedTokenAddress(
        usdcMint,
        cancelListingPda,
        true
      );

      // Create listing
      await program.methods
        .createListing(
          cancelListingId,
          price,
          Array.from(metadataHash),
          shippingCost
        )
        .accounts({
          seller: seller.publicKey,
          listing: cancelListingPda,
          usdcMint: usdcMint,
          escrowVault: cancelEscrowVault,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([seller])
        .rpc();

      // Buyer purchases it
      await program.methods
        .buyItem()
        .accounts({
          buyer: buyer.publicKey,
          listing: cancelListingPda,
          usdcMint: usdcMint,
          buyerTokenAccount: buyerTokenAccount,
          escrowVault: cancelEscrowVault,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([buyer])
        .rpc();
    });

    it("should refund buyer and reset listing to Available", async () => {
      const buyerBalanceBefore = Number(
        (await getAccount(connection, buyerTokenAccount)).amount
      );

      await program.methods
        .cancelPurchase()
        .accounts({
          buyer: buyer.publicKey,
          listing: cancelListingPda,
          usdcMint: usdcMint,
          escrowVault: cancelEscrowVault,
          buyerTokenAccount: buyerTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([buyer])
        .rpc();

      // Verify listing status reset
      const listing = await program.account.listing.fetch(cancelListingPda);
      expect(listing.status).to.deep.equal({ available: {} });
      expect(listing.buyer.toBase58()).to.equal(PublicKey.default.toBase58());

      // Verify buyer got full refund
      const buyerBalanceAfter = Number(
        (await getAccount(connection, buyerTokenAccount)).amount
      );
      expect(buyerBalanceAfter - buyerBalanceBefore).to.equal(
        totalBuyerPays.toNumber()
      );

      // Verify escrow is empty
      const vault = await getAccount(connection, cancelEscrowVault);
      expect(Number(vault.amount)).to.equal(0);
    });

    it("should reject cancellation by non-buyer", async () => {
      // First, have buyer re-purchase so it's in escrow again
      await program.methods
        .buyItem()
        .accounts({
          buyer: buyer.publicKey,
          listing: cancelListingPda,
          usdcMint: usdcMint,
          buyerTokenAccount: buyerTokenAccount,
          escrowVault: cancelEscrowVault,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([buyer])
        .rpc();

      // Seller tries to cancel (should fail)
      try {
        await program.methods
          .cancelPurchase()
          .accounts({
            buyer: seller.publicKey,
            listing: cancelListingPda,
            usdcMint: usdcMint,
            escrowVault: cancelEscrowVault,
            buyerTokenAccount: sellerTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([seller])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.toString()).to.include("UnauthorizedBuyer");
      }
    });
  });

  describe("cancel_listing", () => {
    const cancelListingId2 = new BN(4);
    let cancelListingPda2: PublicKey;
    let cancelEscrowVault2: PublicKey;

    before(async () => {
      [cancelListingPda2] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("listing"),
          seller.publicKey.toBuffer(),
          cancelListingId2.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );
      cancelEscrowVault2 = await getAssociatedTokenAddress(
        usdcMint,
        cancelListingPda2,
        true
      );

      // Create listing
      await program.methods
        .createListing(
          cancelListingId2,
          price,
          Array.from(metadataHash),
          shippingCost
        )
        .accounts({
          seller: seller.publicKey,
          listing: cancelListingPda2,
          usdcMint: usdcMint,
          escrowVault: cancelEscrowVault2,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([seller])
        .rpc();
    });

    it("should close the listing and return rent to seller", async () => {
      const sellerLamportsBefore = await connection.getBalance(
        seller.publicKey
      );

      await program.methods
        .cancelListing()
        .accounts({
          seller: seller.publicKey,
          listing: cancelListingPda2,
          systemProgram: SystemProgram.programId,
        })
        .signers([seller])
        .rpc();

      // Verify listing account is closed
      const account = await connection.getAccountInfo(cancelListingPda2);
      expect(account).to.be.null;

      // Verify seller got rent back (balance increased)
      const sellerLamportsAfter = await connection.getBalance(
        seller.publicKey
      );
      expect(sellerLamportsAfter).to.be.greaterThan(sellerLamportsBefore);
    });

    it("should reject cancellation by non-seller", async () => {
      // Create another listing to test authorization
      const lid = new BN(5);
      const [pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("listing"),
          seller.publicKey.toBuffer(),
          lid.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );
      const vault = await getAssociatedTokenAddress(usdcMint, pda, true);

      await program.methods
        .createListing(lid, price, Array.from(metadataHash), shippingCost)
        .accounts({
          seller: seller.publicKey,
          listing: pda,
          usdcMint: usdcMint,
          escrowVault: vault,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([seller])
        .rpc();

      // Buyer tries to cancel seller's listing (should fail)
      try {
        await program.methods
          .cancelListing()
          .accounts({
            seller: buyer.publicKey,
            listing: pda,
            systemProgram: SystemProgram.programId,
          })
          .signers([buyer])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err.toString()).to.include("UnauthorizedSeller");
      }
    });
  });
});
