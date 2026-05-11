'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { getEventDropHref } from '@/lib/events';
import { getShippingMethodDisplay } from '@/lib/shippingMethods';
import styles from './ListingCard.module.css';

export type ListingData = {
  id: string;
  title: string;
  description: string;
  eventName: string;
  category: string;
  condition: string;
  size: string;
  priceUsdc: number;
  shippingCost: number;
  shippingMethod?: string | null;
  images: string[];
  status: 'available' | 'in_escrow' | 'sold' | 'cancelled';
  sellerWallet: string;
  createdAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  in_escrow: 'In Escrow',
  sold: 'Sold',
  cancelled: 'Cancelled',
};

type ListingCardProps = {
  listing: ListingData;
  statusLabelOverride?: string;
};

export function ListingCard({ listing, statusLabelOverride }: ListingCardProps) {
  const priceFormatted = (listing.priceUsdc / 1_000_000).toFixed(2);
  const shippingFormatted = (listing.shippingCost / 1_000_000).toFixed(2);
  const shippingMethod = getShippingMethodDisplay(listing.shippingMethod, listing.shippingCost);
  const listingHref = `/listing/${listing.id}`;
  const eventHref = getEventDropHref(listing.eventName);
  const statusClass =
    listing.status === 'available'
      ? 'badge-available'
      : listing.status === 'in_escrow'
        ? 'badge-escrow'
        : listing.status === 'sold'
          ? 'badge-completed'
          : 'badge-cancelled';

  return (
    <article className={styles.card}>
      <Link href={listingHref} className={styles.imageLink} aria-label={`View ${listing.title}`}>
        <div className={styles.imageContainer}>
        {listing.images.length > 0 ? (
          <Image
            src={listing.images[0]}
            alt={listing.title}
            className={styles.image}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            unoptimized
          />
        ) : (
          <div className={styles.placeholderImage} aria-hidden="true">
            <div className={styles.merchShape}>
              <span className={styles.neck} />
              <span className={styles.print} />
            </div>
            <span className={styles.placeholderLabel}>{listing.category}</span>
          </div>
        )}
        <div className={styles.statusBadge}>
          <span className={`badge ${statusClass}`}>
            {statusLabelOverride ?? STATUS_LABELS[listing.status]}
          </span>
        </div>
        </div>
      </Link>

      <div className={styles.content}>
        {eventHref ? (
          <Link href={eventHref} className={styles.eventTag}>
            <span className={styles.eventDot} />
            {listing.eventName}
          </Link>
        ) : (
          <span className={styles.eventTag}>
            <span className={styles.eventDot} />
            {listing.eventName}
          </span>
        )}

        <h3 className={styles.title}>
          <Link href={listingHref} className={styles.titleLink}>
            {listing.title}
          </Link>
        </h3>

        <div className={styles.meta}>
          <span className={styles.condition}>{listing.condition}</span>
          {listing.size && (
            <>
              <span className={styles.divider}>·</span>
              <span>{listing.size}</span>
            </>
          )}
        </div>

        <div className={styles.priceRow}>
          <div className={styles.price}>
            <span className={styles.priceAmount}>{priceFormatted}</span>
            <span className={`badge badge-usdc ${styles.usdcBadge}`}>
              USDC
            </span>
          </div>
          <span className={styles.shipping}>
            {shippingMethod} · {shippingFormatted} shipping
          </span>
        </div>
      </div>
    </article>
  );
}
