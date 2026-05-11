'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ListingCard, ListingData } from './ListingCard';
import { fetchListings, ListingFilters } from '@/lib/api';
import { EVENT_DROPS } from '@/lib/events';
import { getFallbackListings } from '@/lib/localListings';
import type { DbListing } from '@/lib/supabase';
import styles from './BrowseSection.module.css';

const EVENTS = ['All Events', ...EVENT_DROPS.map((event) => event.name)];
const CATEGORIES = ['All Categories', 'T-Shirt', 'Hoodie', 'Cap', 'Jacket', 'Bag', 'Accessories'];
const CONDITIONS = ['All Conditions', 'New', 'Like New', 'Good', 'Fair'];

function dbToCardData(db: DbListing): ListingData {
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
    status: db.status === 'in_escrow' ? 'in_escrow' : db.status,
    sellerWallet: db.seller_wallet,
    createdAt: db.created_at,
  };
}

export function BrowseSection() {
  const [eventFilter, setEventFilter] = useState('All Events');
  const [categoryFilter, setCategoryFilter] = useState('All Categories');
  const [conditionFilter, setConditionFilter] = useState('All Conditions');
  const [searchQuery, setSearchQuery] = useState('');
  const [listings, setListings] = useState<ListingData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [usingFallbackData, setUsingFallbackData] = useState(true);

  // Try fetching from API on mount
  const loadListings = useCallback(async () => {
    const filters: ListingFilters = { status: 'available' };
    if (eventFilter !== 'All Events') filters.event = eventFilter;
    if (categoryFilter !== 'All Categories') filters.category = categoryFilter;
    if (conditionFilter !== 'All Conditions') filters.condition = conditionFilter;
    if (searchQuery) filters.search = searchQuery;

    try {
      setIsLoading(true);
      const result = await fetchListings(filters);
      setListings(result.listings.map(dbToCardData));
      setUsingFallbackData(false);
    } catch {
      setListings(getFallbackListings(filters).map(dbToCardData));
      setUsingFallbackData(true);
    } finally {
      setIsLoading(false);
    }
  }, [eventFilter, categoryFilter, conditionFilter, searchQuery]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const displayListings = listings;

  return (
    <div className={styles.browse}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Latest drops</h2>
          <p className={styles.subtitle}>
            Search the table before the crowd does. Every price includes the same 5% protection fee.
          </p>
        </div>
      </div>

      <div className={styles.eventLinks} aria-label="Event drop pages">
        {EVENT_DROPS.slice(0, 4).map((event) => (
          <Link key={event.slug} href={`/event/${event.slug}`} className={styles.eventLink}>
            <span>{event.shortName}</span>
            <strong>{event.year}</strong>
          </Link>
        ))}
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <label className="sr-only" htmlFor="search-listings">
          Search listings
        </label>
        <input
          type="text"
          className={`input-field ${styles.searchInput}`}
          placeholder="Search merch, event, or category"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          id="search-listings"
          autoComplete="off"
        />
        <label className="sr-only" htmlFor="filter-event">
          Filter by event
        </label>
        <select
          className={`input-field select-field ${styles.filterSelect}`}
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          id="filter-event"
        >
          {EVENTS.map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="filter-category">
          Filter by category
        </label>
        <select
          className={`input-field select-field ${styles.filterSelect}`}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          id="filter-category"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="filter-condition">
          Filter by condition
        </label>
        <select
          className={`input-field select-field ${styles.filterSelect}`}
          value={conditionFilter}
          onChange={(e) => setConditionFilter(e.target.value)}
          id="filter-condition"
        >
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Results */}
      <div className={styles.results}>
        <span className={styles.resultCount}>
          {displayListings.length} item{displayListings.length !== 1 ? 's' : ''}
          {usingFallbackData && (
            <span className={styles.mockLabel}> · Local demo data</span>
          )}
        </span>
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className={styles.grid}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <div className={`skeleton ${styles.skeletonImage}`} />
              <div className={styles.skeletonContent}>
                <div className={`skeleton ${styles.skeletonLineShort}`} />
                <div className={`skeleton ${styles.skeletonLineLong}`} />
                <div className={`skeleton ${styles.skeletonLinePrice}`} />
              </div>
            </div>
          ))}
        </div>
      ) : displayListings.length > 0 ? (
        <div className={styles.grid}>
          {displayListings.map((listing) => (
            <div key={listing.id} className={styles.gridItem}>
              <ListingCard listing={listing} />
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden="true" />
          <p>No merch found matching your filters</p>
          <button
            className="btn btn-secondary"
            onClick={() => {
              setEventFilter('All Events');
              setCategoryFilter('All Categories');
              setConditionFilter('All Conditions');
              setSearchQuery('');
            }}
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}
