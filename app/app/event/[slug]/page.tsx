'use client';

import React, { useCallback, useEffect, use, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchListings } from '@/lib/api';
import { getEventDropBySlug, getSupplyReadiness } from '@/lib/events';
import { getFallbackListings } from '@/lib/localListings';
import type { DbListing } from '@/lib/supabase';
import { ListingCard, ListingData } from '../../components/ListingCard';
import styles from './page.module.css';

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
    status: db.status,
    sellerWallet: db.seller_wallet,
    createdAt: db.created_at,
  };
}

function statusCount(listings: ListingData[], status: ListingData['status']) {
  return listings.filter((listing) => listing.status === status).length;
}

const LAUNCH_STATUS_LABEL = {
  'launch-drop': 'Launch drop',
  seeded: 'Seeded shelf',
  catalog: 'Catalog shelf',
} as const;

export default function EventDropPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const event = getEventDropBySlug(slug);
  const [listings, setListings] = useState<ListingData[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(event));
  const [usingFallbackData, setUsingFallbackData] = useState(false);
  const [loadError, setLoadError] = useState<string>();

  const loadListings = useCallback(async () => {
    if (!event) return;

    setIsLoading(true);
    setLoadError(undefined);

    try {
      const result = await fetchListings({ event: event.name, limit: 100 });
      const remoteListings = result.listings.map(dbToCardData);
      const fallbackListings = getFallbackListings({ event: event.name, limit: 100 }).map(dbToCardData);

      if (remoteListings.length === 0 && event.launchStatus === 'launch-drop' && fallbackListings.length > 0) {
        setListings(fallbackListings);
        setUsingFallbackData(true);
        setLoadError('Showing curated local seed inventory until this launch drop has live listings.');
      } else {
        setListings(remoteListings);
        setUsingFallbackData(false);
      }
    } catch {
      setListings(getFallbackListings({ event: event.name, limit: 100 }).map(dbToCardData));
      setUsingFallbackData(true);
      setLoadError('Showing local demo inventory while the marketplace database is unavailable.');
    } finally {
      setIsLoading(false);
    }
  }, [event]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const stats = useMemo(() => {
    return {
      total: listings.length,
      available: statusCount(listings, 'available'),
      escrow: statusCount(listings, 'in_escrow'),
      sold: statusCount(listings, 'sold'),
      cancelled: statusCount(listings, 'cancelled'),
    };
  }, [listings]);
  const readiness = event ? getSupplyReadiness(event, stats.total) : null;

  if (!event) {
    return (
      <main className={styles.page}>
        <section className={styles.notFound}>
          <span className={styles.emptyMark} aria-hidden="true" />
          <h1>Event drop not found</h1>
          <p>This shelf is not in the Merchplace event catalog yet.</p>
          <Link href="/" className="btn btn-secondary">
            Back to browse
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <Link href="/" className={styles.backLink}>Back to browse</Link>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Event drop</span>
          <h1>{event.name}</h1>
          <p>{event.summary}</p>
          <div className={styles.heroActions}>
            <Link href="/listing/create" className="btn btn-primary">
              List merch from this event
            </Link>
            <a href="#inventory" className="btn btn-secondary">
              Browse inventory
            </a>
          </div>
        </div>

        <aside className={styles.dropPanel} aria-label={`${event.name} drop details`}>
          <div className={styles.dropHeader}>
            <span>{event.shortName}</span>
            <strong>{event.year}</strong>
          </div>
          <div className={styles.statusPill}>
            {LAUNCH_STATUS_LABEL[event.launchStatus]}
          </div>
          <dl className={styles.dropTerms}>
            <div>
              <dt>Location</dt>
              <dd>{event.location}</dd>
            </div>
            <div>
              <dt>Seller prompt</dt>
              <dd>{event.sellerPrompt}</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className={styles.statsBand} aria-label={`${event.name} inventory stats`}>
        <div>
          <span>Total</span>
          <strong>{stats.total}</strong>
        </div>
        <div>
          <span>Available</span>
          <strong>{stats.available}</strong>
        </div>
        <div>
          <span>In escrow</span>
          <strong>{stats.escrow}</strong>
        </div>
        <div>
          <span>Sold</span>
          <strong>{stats.sold}</strong>
        </div>
      </section>

      {readiness && (
        <section className={styles.supplyProof} aria-label={`${event.name} supply proof`}>
          <div className={styles.readinessPanel}>
            <span className={styles.eyebrow}>Supply proof</span>
            <h2>
              {readiness.current}/{readiness.goal} launch inventory target
            </h2>
            <div
              className={styles.progressTrack}
              aria-label={`${readiness.percent}% of inventory target reached`}
            >
              <span style={{ width: `${readiness.percent}%` }} />
            </div>
            <p>
              {readiness.remaining > 0
                ? `${readiness.remaining} more credible listings make this drop feel launch-ready.`
                : 'This drop has enough seeded inventory to support a focused launch push.'}
            </p>
          </div>

          <div className={styles.proofColumn}>
            <span className={styles.cardKicker}>Wanted inventory</span>
            <ul className={styles.compactList}>
              {event.wantedInventory.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className={styles.proofColumn}>
            <span className={styles.cardKicker}>Seller slots</span>
            <ul className={styles.compactList}>
              {event.sellerSlots.map((slot) => (
                <li key={slot}>{slot}</li>
              ))}
            </ul>
          </div>

          <div className={styles.curationNote}>
            <span className={styles.cardKicker}>Curation standard</span>
            <p>{event.curationStandard}</p>
          </div>
        </section>
      )}

      <section id="inventory" className={styles.inventory}>
        <div className={styles.inventoryHeader}>
          <div>
            <h2>Drop inventory</h2>
            <p>
              Every listing keeps item price, shipping, and buyer protection visible before wallet approval.
            </p>
          </div>
          {usingFallbackData && (
            <span className={styles.fallbackBadge}>Local demo data</span>
          )}
        </div>

        {loadError && (
          <p className={styles.loadNote} role="status">
            {loadError}
          </p>
        )}

        {isLoading ? (
          <div className={styles.grid}>
            {[...Array(3)].map((_, index) => (
              <div key={index} className={styles.skeletonCard}>
                <div className={`skeleton ${styles.skeletonImage}`} />
                <div className={styles.skeletonContent}>
                  <div className={`skeleton ${styles.skeletonLineShort}`} />
                  <div className={`skeleton ${styles.skeletonLineLong}`} />
                  <div className={`skeleton ${styles.skeletonLinePrice}`} />
                </div>
              </div>
            ))}
          </div>
        ) : listings.length > 0 ? (
          <div className={styles.grid}>
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span className={styles.emptyMark} aria-hidden="true" />
            <h2>No merch listed for {event.name}</h2>
            <p>{event.sellerPrompt}</p>
            <Link href="/listing/create" className="btn btn-primary">
              Seed this drop
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
