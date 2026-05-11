'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { fetchListings } from '@/lib/api';
import { getFallbackListings } from '@/lib/localListings';
import { buildSolscanAddressUrl, truncateAddress } from '@/lib/solanaDisplay';
import { ListingCard, ListingData } from '../components/ListingCard';
import type { DbListing } from '@/lib/supabase';
import styles from './page.module.css';

type Tab = 'listings' | 'purchases' | 'sold';

function dbToCard(db: DbListing): ListingData {
  return {
    id: db.id,
    title: db.title,
    description: db.description || '',
    eventName: db.event_name,
    category: db.category,
    condition: db.condition,
    size: db.size || '',
    priceUsdc: db.price_usdc,
    shippingCost: db.shipping_cost,
    shippingMethod: db.shipping_method,
    images: db.images || [],
    status: db.status,
    sellerWallet: db.seller_wallet,
    createdAt: db.created_at,
  };
}

export default function ProfilePage() {
  const { connected, publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<Tab>('listings');
  const [myListings, setMyListings] = useState<ListingData[]>([]);
  const [purchases, setPurchases] = useState<ListingData[]>([]);
  const [soldItems, setSoldItems] = useState<ListingData[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!connected || !publicKey) return;
    const wallet = publicKey.toBase58();

    async function loadData() {
      setLoading(true);
      try {
        // Fetch my listings
        const listingsRes = await fetchListings({ seller: wallet, limit: 50 });
        setMyListings(listingsRes.listings.map(dbToCard));

        // Sold items = my listings with status 'sold'
        setSoldItems(
          listingsRes.listings
            .filter((l) => l.status === 'sold')
            .map(dbToCard)
        );

        // Fetch purchases (where I'm the buyer)
        const purchasesRes = await fetchListings({ buyer: wallet, limit: 50 });
        setPurchases(purchasesRes.listings.map(dbToCard));
      } catch {
        const localListings = getFallbackListings({ seller: wallet, limit: 50 });
        setMyListings(localListings.map(dbToCard));
        setSoldItems(
          localListings
            .filter((listing) => listing.status === 'sold')
            .map(dbToCard)
        );
        setPurchases(
          getFallbackListings({ buyer: wallet, limit: 50 }).map(dbToCard)
        );
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [connected, publicKey]);

  if (!connected || !publicKey) {
    return (
      <div className={styles.connectPrompt}>
        <div className={styles.promptContent}>
          <span className={styles.promptIcon} aria-hidden="true" />
          <h2>Connect your wallet</h2>
          <p>Connect your Solana wallet to view your profile.</p>
        </div>
      </div>
    );
  }

  const walletAddress = publicKey.toBase58();
  const shortAddress = truncateAddress(walletAddress);
  const copyWallet = async () => {
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const activeItems =
    activeTab === 'listings'
      ? myListings
      : activeTab === 'purchases'
        ? purchases
        : soldItems;

  return (
    <div className={styles.page}>
      {/* Profile Header */}
      <div className={styles.profileHeader}>
        <div className={styles.avatar}>
          <span>{walletAddress.slice(0, 2).toUpperCase()}</span>
        </div>
        <div className={styles.profileInfo}>
          <span className={styles.profileKicker}>Collector account</span>
          <h1 className={styles.profileName}>{shortAddress}</h1>
          <button
            type="button"
            className={styles.copyBtn}
            onClick={copyWallet}
            aria-label="Copy wallet address"
          >
            <span className={styles.copyIcon} aria-hidden="true" />
            <span>{copied ? 'Copied' : truncateAddress(walletAddress, 6)}</span>
          </button>
          <a
            className={styles.explorerLink}
            href={buildSolscanAddressUrl(walletAddress)}
            target="_blank"
            rel="noreferrer"
          >
            View on Solscan
            <span className={styles.externalMark} aria-hidden="true" />
          </a>
        </div>
        <div className={styles.profileStats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{myListings.length}</span>
            <span className={styles.statLabel}>Listed</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{soldItems.length}</span>
            <span className={styles.statLabel}>Sold</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{purchases.length}</span>
            <span className={styles.statLabel}>Bought</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs} role="tablist" aria-label="Profile sections">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'listings'}
          className={`${styles.tab} ${activeTab === 'listings' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('listings')}
        >
          My Listings
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'purchases'}
          className={`${styles.tab} ${activeTab === 'purchases' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('purchases')}
        >
          Purchases
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'sold'}
          className={`${styles.tab} ${activeTab === 'sold' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('sold')}
        >
          Sold Items
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.tabContent}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className={`skeleton ${styles.loadingBlock}`} />
            <p>Loading your desk</p>
          </div>
        ) : activeItems.length > 0 ? (
          <div className={styles.listingGrid}>
            {activeItems.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon} aria-hidden="true" />
            <p>
              {activeTab === 'listings'
                ? "You haven't listed any merch yet"
                : activeTab === 'purchases'
                  ? "You haven't purchased anything yet"
                  : "You haven't sold anything yet"}
            </p>
            {activeTab === 'listings' && (
              <Link href="/listing/create" className="btn btn-primary">
                Create your first listing
              </Link>
            )}
            {activeTab === 'purchases' && (
              <Link href="/" className="btn btn-secondary">
                Browse merch
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
