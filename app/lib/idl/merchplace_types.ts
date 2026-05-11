/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/merchplace.json`.
 */
export type Merchplace = {
  "address": "BWM5Sppg3Qu2mZCGM9ZiwWxDe9st3y4x3rb4Yur7Hauj",
  "metadata": {
    "name": "merchplace",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Merchplace - Solana escrow marketplace for event merch"
  },
  "instructions": [
    {
      "name": "buyItem",
      "docs": [
        "Buyer purchases an item by depositing USDC (price + shipping + platform fee)",
        "into the escrow vault PDA."
      ],
      "discriminator": [
        80,
        82,
        193,
        201,
        216,
        27,
        70,
        184
      ],
      "accounts": [
        {
          "name": "buyer",
          "docs": [
            "The buyer purchasing the item."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "listing",
          "docs": [
            "The listing PDA — must be in Available status."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "listing.seller",
                "account": "listing"
              },
              {
                "kind": "account",
                "path": "listing.listing_id",
                "account": "listing"
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "docs": [
            "The USDC mint."
          ]
        },
        {
          "name": "buyerTokenAccount",
          "docs": [
            "The buyer's USDC token account (source of funds)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "escrowVault",
          "docs": [
            "The escrow vault PDA token account (destination for buyer's USDC)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "listing"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "cancelListing",
      "docs": [
        "Seller cancels an unsold listing."
      ],
      "discriminator": [
        41,
        183,
        50,
        232,
        230,
        233,
        157,
        70
      ],
      "accounts": [
        {
          "name": "seller",
          "docs": [
            "The seller cancelling their listing."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "listing",
          "docs": [
            "The listing PDA — must be in Available status (cannot cancel if in escrow)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "listing.seller",
                "account": "listing"
              },
              {
                "kind": "account",
                "path": "listing.listing_id",
                "account": "listing"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "cancelPurchase",
      "docs": [
        "Buyer cancels the purchase before shipment. Full refund from escrow."
      ],
      "discriminator": [
        47,
        200,
        220,
        12,
        114,
        54,
        229,
        198
      ],
      "accounts": [
        {
          "name": "buyer",
          "docs": [
            "The buyer requesting a cancellation/refund."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "listing",
          "docs": [
            "The listing PDA — must be in InEscrow status."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "listing.seller",
                "account": "listing"
              },
              {
                "kind": "account",
                "path": "listing.listing_id",
                "account": "listing"
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "docs": [
            "The USDC mint."
          ]
        },
        {
          "name": "escrowVault",
          "docs": [
            "The escrow vault PDA (source — returns USDC to buyer)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "listing"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "buyerTokenAccount",
          "docs": [
            "The buyer's USDC token account (receives refund)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "buyer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "confirmReceipt",
      "docs": [
        "Buyer confirms receipt of the item. Escrow releases USDC:",
        "- Item price → seller",
        "- Platform fee → treasury",
        "- Shipping cost was already factored into escrow"
      ],
      "discriminator": [
        203,
        36,
        80,
        115,
        249,
        12,
        141,
        170
      ],
      "accounts": [
        {
          "name": "buyer",
          "docs": [
            "The buyer confirming they received the item."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "listing",
          "docs": [
            "The listing PDA — must be in InEscrow status."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "listing.seller",
                "account": "listing"
              },
              {
                "kind": "account",
                "path": "listing.listing_id",
                "account": "listing"
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "docs": [
            "The USDC mint."
          ]
        },
        {
          "name": "escrowVault",
          "docs": [
            "The escrow vault PDA (source — releases USDC)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "listing"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "sellerTokenAccount",
          "docs": [
            "The seller's USDC token account (receives item price + shipping cost)."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "seller"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "seller",
          "docs": [
            "The seller wallet (for ATA derivation)."
          ]
        },
        {
          "name": "treasuryTokenAccount",
          "docs": [
            "The platform treasury USDC token account (receives the 5% fee)."
          ],
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": []
    },
    {
      "name": "createListing",
      "docs": [
        "Seller creates a new listing with a price in USDC.",
        "The listing PDA stores metadata hash, price, and status."
      ],
      "discriminator": [
        18,
        168,
        45,
        24,
        191,
        31,
        117,
        54
      ],
      "accounts": [
        {
          "name": "seller",
          "docs": [
            "The seller creating the listing."
          ],
          "writable": true,
          "signer": true
        },
        {
          "name": "listing",
          "docs": [
            "The listing PDA — stores all on-chain listing data."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  108,
                  105,
                  115,
                  116,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "seller"
              },
              {
                "kind": "arg",
                "path": "listingId"
              }
            ]
          }
        },
        {
          "name": "usdcMint",
          "docs": [
            "The USDC mint account (validated by the caller)."
          ]
        },
        {
          "name": "escrowVault",
          "docs": [
            "The escrow vault — a PDA-owned token account that will hold buyer's USDC."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "listing"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "usdcMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "listingId",
          "type": "u64"
        },
        {
          "name": "price",
          "type": "u64"
        },
        {
          "name": "metadataHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "shippingCost",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "listing",
      "discriminator": [
        218,
        32,
        50,
        73,
        43,
        134,
        26,
        58
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidPrice",
      "msg": "Price must be greater than zero"
    },
    {
      "code": 6001,
      "name": "listingNotAvailable",
      "msg": "Listing is not available for purchase"
    },
    {
      "code": 6002,
      "name": "listingNotInEscrow",
      "msg": "Listing is not in escrow"
    },
    {
      "code": 6003,
      "name": "unauthorizedBuyer",
      "msg": "Only the buyer can perform this action"
    },
    {
      "code": 6004,
      "name": "unauthorizedSeller",
      "msg": "Only the seller can perform this action"
    },
    {
      "code": 6005,
      "name": "cannotBuyOwnListing",
      "msg": "Cannot buy your own listing"
    },
    {
      "code": 6006,
      "name": "arithmeticOverflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6007,
      "name": "listingAlreadySold",
      "msg": "Listing has already been purchased and cannot be cancelled"
    },
    {
      "code": 6008,
      "name": "invalidUsdcMint",
      "msg": "Invalid USDC mint address"
    }
  ],
  "types": [
    {
      "name": "listing",
      "docs": [
        "On-chain listing account that tracks a marketplace item.",
        "",
        "PDA seeds: [b\"listing\", seller.key(), listing_id.to_le_bytes()]"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "seller",
            "docs": [
              "The seller's wallet address."
            ],
            "type": "pubkey"
          },
          {
            "name": "buyer",
            "docs": [
              "The buyer's wallet address (set when purchased)."
            ],
            "type": "pubkey"
          },
          {
            "name": "price",
            "docs": [
              "Price of the item in USDC (6 decimals, e.g., 10_000_000 = 10 USDC)."
            ],
            "type": "u64"
          },
          {
            "name": "shippingCost",
            "docs": [
              "Shipping cost in USDC (6 decimals). Paid by the buyer."
            ],
            "type": "u64"
          },
          {
            "name": "metadataHash",
            "docs": [
              "SHA-256 hash of the off-chain metadata (title, description, images, etc.)."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "listingId",
            "docs": [
              "Unique listing identifier (per seller)."
            ],
            "type": "u64"
          },
          {
            "name": "status",
            "docs": [
              "Current status of the listing."
            ],
            "type": {
              "defined": {
                "name": "listingStatus"
              }
            }
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp when the listing was created."
            ],
            "type": "i64"
          },
          {
            "name": "escrowFundedAt",
            "docs": [
              "Unix timestamp when escrow was funded (for timeout logic)."
            ],
            "type": "i64"
          },
          {
            "name": "listingBump",
            "docs": [
              "Bump seed for the listing PDA."
            ],
            "type": "u8"
          },
          {
            "name": "escrowBump",
            "docs": [
              "Bump seed for the escrow vault PDA."
            ],
            "type": "u8"
          },
          {
            "name": "usdcMint",
            "docs": [
              "The USDC mint address this listing uses."
            ],
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "listingStatus",
      "docs": [
        "Represents the status of a marketplace listing."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "available"
          },
          {
            "name": "inEscrow"
          },
          {
            "name": "completed"
          },
          {
            "name": "cancelled"
          }
        ]
      }
    }
  ]
};
