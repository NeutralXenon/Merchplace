'use client';

import React, { useState, useEffect, use } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { ensureWalletSession } from '@/lib/authClient';
import {
  useProgram,
  buyItemOnChain,
  confirmReceiptOnChain,
  cancelPurchaseOnChain,
  cancelListingOnChain,
  PublicKey,
} from '@/lib/program';
import { fetchListing, fetchShipping, updateListing, upsertShipping } from '@/lib/api';
import { getErrorMessage, getWalletErrorMessage } from '@/lib/errors';
import {
  getListingStatusSyncErrorMessage,
  type ListingStatusSyncAction,
} from '@/lib/listingStatusSync';
import {
  getFallbackListing,
  getFallbackShipping,
  updateLocalListing,
} from '@/lib/localListings';
import { saveSellerShipment } from '@/lib/shippingPersistence';
import {
  buildSolscanAddressUrl,
  formatUsdcMicro,
  getMarketplaceTotals,
  truncateAddress,
} from '@/lib/solanaDisplay';
import { SHIPPING_CARRIER_OPTIONS, resolveShippingMethod } from '@/lib/shippingMethods';
import {
  ESCROW_POLICY_STEPS,
  getEscrowRoleNotice,
  getReviewChecklist,
  type EscrowNoticeTone,
} from '@/lib/escrowTrust';
import {
  DISPUTE_POLICY,
  getDisputeGuidance,
  getDisputeTimeline,
  getReviewRiskNotes,
} from '@/lib/disputePolicy';
import { TransactionStatus, TxStatus } from '../../components/TransactionStatus';
import { TransactionReviewModal, ReviewLine } from '../../components/TransactionReviewModal';
import type { DbListing, DbShipping } from '@/lib/supabase';
import styles from './page.module.css';

type ReviewAction = 'buy' | 'confirm' | 'cancelPurchase' | 'cancelListing';
type StatusSyncUpdates = {
  status: DbListing['status'];
  buyer_wallet?: string | null;
  tx_signature: string;
};
type StatusSyncPatch = Partial<Pick<DbListing, 'status' | 'buyer_wallet'>>;
type PendingStatusSync = {
  action: ListingStatusSyncAction;
  updates: StatusSyncUpdates;
  localPatch: StatusSyncPatch;
};

export default function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { connected, publicKey, signMessage } = useWallet();
  const { program } = useProgram();
  const [listing, setListing] = useState<DbListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txSignature, setTxSignature] = useState<string>();
  const [txError, setTxError] = useState<string>();
  const [pendingStatusSync, setPendingStatusSync] = useState<PendingStatusSync | null>(null);
  const [isStatusSyncRetrying, setIsStatusSyncRetrying] = useState(false);
  const [reviewAction, setReviewAction] = useState<ReviewAction | null>(null);
  const [shipment, setShipment] = useState<DbShipping | null>(null);
  const [shippingForm, setShippingForm] = useState({
    carrier: '',
    trackingNumber: '',
  });
  const [shippingSaving, setShippingSaving] = useState(false);
  const [shippingError, setShippingError] = useState<string>();
  const [shippingSaved, setShippingSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchListing(id);
        setListing(data);
        let shipment: DbShipping | null = null;
        try {
          shipment = await fetchShipping(data.id);
        } catch {
          shipment = getFallbackShipping(data.id);
        }
        setShipment(shipment);
        const preferredCarrier = resolveShippingMethod(data.shipping_method, data.shipping_cost).carrier;
        setShippingForm({
          carrier: shipment?.carrier ?? preferredCarrier,
          trackingNumber: shipment?.tracking_number ?? '',
        });
      } catch {
        const fallback = getFallbackListing(id);
        const shipment = fallback ? getFallbackShipping(fallback.id) : null;
        setListing(fallback);
        setShipment(shipment);
        const preferredCarrier = fallback
          ? resolveShippingMethod(fallback.shipping_method, fallback.shipping_cost).carrier
          : '';
        setShippingForm({
          carrier: shipment?.carrier ?? preferredCarrier,
          trackingNumber: shipment?.tracking_number ?? '',
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const resetTx = () => {
    setTxStatus('idle');
    setTxSignature(undefined);
    setTxError(undefined);
    setPendingStatusSync(null);
  };

  const syncStatusUpdate = async (
    action: ListingStatusSyncAction,
    updates: StatusSyncUpdates,
    localPatch: StatusSyncPatch
  ) => {
    if (!listing) return;

    setPendingStatusSync({ action, updates, localPatch });
    setTxStatus('syncing');
    setTxError(undefined);

    try {
      const saved = await updateListing(listing.id, updates);
      updateLocalListing(listing.id, localPatch);
      setListing(saved);
      setPendingStatusSync(null);
      setTxStatus('success');
    } catch (err: unknown) {
      setTxError(getListingStatusSyncErrorMessage(action, err));
      setTxStatus('syncError');
    }
  };

  const retryStatusSync = async () => {
    if (!pendingStatusSync) return;

    setIsStatusSyncRetrying(true);
    try {
      await syncStatusUpdate(
        pendingStatusSync.action,
        pendingStatusSync.updates,
        pendingStatusSync.localPatch
      );
    } finally {
      setIsStatusSyncRetrying(false);
    }
  };

  const runReviewedAction = async () => {
    const action = reviewAction;
    if (!action) return;

    setReviewAction(null);

    if (action === 'buy') {
      await handleBuy();
    } else if (action === 'confirm') {
      await handleConfirm();
    } else if (action === 'cancelPurchase') {
      await handleCancelPurchase();
    } else {
      await handleCancelListing();
    }
  };

  const saveShipping = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!listing) return;

    const carrier = shippingForm.carrier.trim();
    const trackingNumber = shippingForm.trackingNumber.trim();

    if (!carrier || !trackingNumber) {
      setShippingError('Add both carrier and tracking number.');
      return;
    }

    setShippingSaving(true);
    setShippingError(undefined);
    setShippingSaved(false);

    const payload = {
      carrier,
      tracking_number: trackingNumber,
      shipped_at: shipment?.shipped_at ?? new Date().toISOString(),
      delivered_at: shipment?.delivered_at ?? null,
    };

    try {
      const saved = await saveSellerShipment({
        listingId: listing.id,
        publicKey,
        signMessage,
        shipment: payload,
        ensureSession: ensureWalletSession,
        saveRemote: upsertShipping,
      });
      setShipment(saved);
      setShippingSaved(true);
      window.setTimeout(() => setShippingSaved(false), 1800);
    } catch (err: unknown) {
      setShippingError(getErrorMessage(err, 'Failed to save tracking.'));
    } finally {
      setShippingSaving(false);
    }
  };

  // --- Buy Item ---
  const handleBuy = async () => {
    if (!program || !publicKey || !listing?.listing_pda) return;
    resetTx();
    setTxStatus('signing');

    try {
      await ensureWalletSession(publicKey, signMessage);

      const listingPda = new PublicKey(listing.listing_pda);
      setTxStatus('sending');
      const { tx } = await buyItemOnChain(program, publicKey, listingPda);
      setTxSignature(tx);
      setTxStatus('confirming');

      // Update DB status with the confirmed on-chain signature for audit history.
      const updates = { status: 'in_escrow' as const, buyer_wallet: publicKey.toBase58() };
      await syncStatusUpdate('buy', { ...updates, tx_signature: tx }, updates);
    } catch (err: unknown) {
      setTxError(getWalletErrorMessage(err, 'Failed to buy item'));
      setTxStatus('error');
    }
  };

  // --- Confirm Receipt ---
  const handleConfirm = async () => {
    if (!program || !publicKey || !listing?.listing_pda) return;
    resetTx();
    setTxStatus('signing');

    try {
      await ensureWalletSession(publicKey, signMessage);

      const listingPda = new PublicKey(listing.listing_pda);
      setTxStatus('sending');
      const { tx } = await confirmReceiptOnChain(program, publicKey, listingPda, new PublicKey(listing.seller_wallet));
      setTxSignature(tx);
      setTxStatus('confirming');

      const updates = { status: 'sold' as const };
      await syncStatusUpdate('confirm', { ...updates, tx_signature: tx }, updates);
    } catch (err: unknown) {
      setTxError(getWalletErrorMessage(err, 'Failed to confirm receipt'));
      setTxStatus('error');
    }
  };

  // --- Cancel Purchase (buyer) ---
  const handleCancelPurchase = async () => {
    if (!program || !publicKey || !listing?.listing_pda) return;
    resetTx();
    setTxStatus('signing');

    try {
      await ensureWalletSession(publicKey, signMessage);

      const listingPda = new PublicKey(listing.listing_pda);
      setTxStatus('sending');
      const { tx } = await cancelPurchaseOnChain(program, publicKey, listingPda);
      setTxSignature(tx);
      setTxStatus('confirming');

      const updates = { status: 'available' as const, buyer_wallet: null };
      await syncStatusUpdate('cancelPurchase', { ...updates, tx_signature: tx }, updates);
    } catch (err: unknown) {
      setTxError(getWalletErrorMessage(err, 'Failed to cancel purchase'));
      setTxStatus('error');
    }
  };

  // --- Cancel Listing (seller) ---
  const handleCancelListing = async () => {
    if (!program || !publicKey || !listing?.listing_pda) return;
    resetTx();
    setTxStatus('signing');

    try {
      await ensureWalletSession(publicKey, signMessage);

      const listingPda = new PublicKey(listing.listing_pda);
      setTxStatus('sending');
      const { tx } = await cancelListingOnChain(program, publicKey, listingPda);
      setTxSignature(tx);
      setTxStatus('confirming');

      const updates = { status: 'cancelled' as const };
      await syncStatusUpdate('cancelListing', { ...updates, tx_signature: tx }, updates);
    } catch (err: unknown) {
      setTxError(getWalletErrorMessage(err, 'Failed to cancel listing'));
      setTxStatus('error');
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingContainer} aria-busy="true">
          <div className={`skeleton ${styles.loadingImage}`} />
          <div className={styles.loadingCopy}>
            <div className={`skeleton ${styles.loadingLineShort}`} />
            <div className={`skeleton ${styles.loadingLineLong}`} />
            <div className={`skeleton ${styles.loadingLineMedium}`} />
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyContainer}>
          <span className={styles.emptyMark} aria-hidden="true" />
          <h2>Listing not found</h2>
          <Link href="/" className="btn btn-secondary">Back to browse</Link>
        </div>
      </div>
    );
  }

  const totals = getMarketplaceTotals(listing.price_usdc, listing.shipping_cost);
  const price = formatUsdcMicro(totals.itemMicro);
  const shipping = formatUsdcMicro(totals.shippingMicro);
  const shippingMethod = resolveShippingMethod(listing.shipping_method, totals.shippingMicro);
  const fee = formatUsdcMicro(totals.buyerProtectionMicro);
  const total = formatUsdcMicro(totals.buyerPaysMicro);
  const sellerReceives = formatUsdcMicro(totals.sellerReceivesMicro);
  const isOwner = publicKey?.toBase58() === listing.seller_wallet;
  const isBuyer = publicKey?.toBase58() === listing.buyer_wallet;
  const walletAddress = publicKey?.toBase58();
  const canEditShipping = listing.status === 'in_escrow' && isOwner;
  const canViewShipping = listing.status === 'in_escrow' && (isOwner || isBuyer);
  const hasTracking = Boolean(shipment?.tracking_number);
  const escrowRole = isOwner ? 'seller' : isBuyer ? 'buyer' : 'visitor';
  const roleNotice = getEscrowRoleNotice(listing.status, escrowRole, hasTracking);
  const disputeGuidance = getDisputeGuidance(listing.status, escrowRole, hasTracking);
  const disputeTimeline = getDisputeTimeline(listing.status, hasTracking);
  const noticeClassByTone: Record<EscrowNoticeTone, string> = {
    info: styles.noticeInfo,
    warning: styles.noticeWarning,
    success: styles.noticeSuccess,
    danger: styles.noticeDanger,
  };

  const statusLabel: Record<string, string> = {
    available: 'Available',
    in_escrow: 'In Escrow',
    sold: 'Sold',
    cancelled: 'Cancelled',
  };
  const statusClass: Record<string, string> = {
    available: 'badge-available',
    in_escrow: 'badge-escrow',
    sold: 'badge-completed',
    cancelled: 'badge-cancelled',
  };

  const reviewLinesByAction: Record<ReviewAction, ReviewLine[]> = {
    buy: [
      { label: 'Item price', value: `${price} USDC` },
      { label: `Shipping (${shippingMethod.carrier})`, value: `${shipping} USDC` },
      { label: 'Buyer protection', value: `${fee} USDC` },
      { label: 'Total deposit', value: `${total} USDC`, tone: 'success' },
    ],
    confirm: [
      { label: 'Release to seller', value: `${sellerReceives} USDC`, tone: 'success' },
      { label: 'Protection fee', value: `${fee} USDC` },
      { label: 'Listing status', value: 'Sold' },
    ],
    cancelPurchase: [
      { label: 'Refund to buyer', value: `${total} USDC`, tone: 'success' },
      { label: 'Listing status', value: 'Available' },
    ],
    cancelListing: [
      { label: 'Escrow movement', value: 'None', tone: 'muted' },
      { label: 'Listing status', value: 'Cancelled', tone: 'danger' },
    ],
  };

  const reviewCopy: Record<ReviewAction, { title: string; subtitle: string; actionLabel: string; danger?: boolean }> = {
    buy: {
      title: 'Review purchase',
      subtitle: 'Your wallet will deposit the total into escrow until receipt is confirmed.',
      actionLabel: 'Sign purchase',
    },
    confirm: {
      title: 'Release escrow',
      subtitle: shipment
        ? 'Confirm only after the package is in hand. This releases seller funds and marks the item as sold.'
        : 'No tracking is saved yet. Confirm only if the item is already in hand.',
      actionLabel: 'Release escrow',
    },
    cancelPurchase: {
      title: 'Cancel purchase',
      subtitle: 'This refunds escrow to the buyer and returns the listing to available.',
      actionLabel: 'Cancel purchase',
      danger: true,
    },
    cancelListing: {
      title: 'Cancel listing',
      subtitle: 'This removes the listing from the marketplace. No funds move.',
      actionLabel: 'Cancel listing',
      danger: true,
    },
  };

  const activeReview = reviewAction ? reviewCopy[reviewAction] : null;

  return (
    <>
      <TransactionStatus
        status={txStatus}
        signature={txSignature}
        errorMessage={txError}
        onClose={resetTx}
        actionLabel="Retry status sync"
        onAction={pendingStatusSync ? retryStatusSync : undefined}
        actionBusy={isStatusSyncRetrying}
      />
      {activeReview && (
        <TransactionReviewModal
          open
          title={activeReview.title}
          subtitle={activeReview.subtitle}
          actionLabel={activeReview.actionLabel}
          danger={activeReview.danger}
          lines={reviewLinesByAction[reviewAction as ReviewAction]}
          checklist={getReviewChecklist(reviewAction as ReviewAction, hasTracking)}
          riskNotes={getReviewRiskNotes(reviewAction as ReviewAction, hasTracking)}
          walletAddress={walletAddress}
          counterpartyAddress={listing.seller_wallet}
          onCancel={() => setReviewAction(null)}
          onConfirm={runReviewedAction}
        />
      )}
      <div className={styles.page}>
        <Link href="/" className={styles.backLink}>Back to browse</Link>

        <div className={styles.layout}>
          {/* Image Gallery */}
          <div className={styles.gallery}>
            {listing.images && listing.images.length > 0 ? (
              <div className={styles.mainImage}>
                <Image
                  src={listing.images[0]}
                  alt={listing.title}
                  className={styles.galleryImage}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  unoptimized
                />
              </div>
            ) : (
              <div className={styles.placeholderImage} aria-hidden="true">
                <div className={styles.merchShape}>
                  <span />
                </div>
              </div>
            )}
            {listing.images && listing.images.length > 1 && (
              <div className={styles.thumbnails}>
                {listing.images.slice(1).map((img, i) => (
                  <div key={i} className={styles.thumb}>
                    <Image
                      src={img}
                      alt={`${listing.title} ${i + 2}`}
                      className={styles.galleryImage}
                      fill
                      sizes="72px"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Details Panel */}
          <div className={styles.details}>
            <div className={styles.detailHeader}>
              <div className={styles.eventTag}>
                <span className={styles.eventDot} />
                {listing.event_name}
              </div>
              <span className={`badge ${statusClass[listing.status]}`}>
                {statusLabel[listing.status]}
              </span>
            </div>

            <h1 className={styles.title}>{listing.title}</h1>

            <div className={styles.meta}>
              <span>{listing.condition}</span>
              {listing.size && (
                <>
                  <span className={styles.dot}>·</span>
                  <span>Size {listing.size}</span>
                </>
              )}
              <span className={styles.dot}>·</span>
              <span>{listing.category}</span>
            </div>

            <div className={styles.priceCard}>
              <span className={styles.cardKicker}>Escrow checkout</span>
              <div className={styles.priceMain}>
                <span className={styles.priceValue}>{price}</span>
                <span className="badge badge-usdc">USDC</span>
              </div>
              <div className={styles.priceBreakdown}>
                <div className={styles.breakdownRow}>
                  <span>Item price</span>
                  <span>{price} USDC</span>
                </div>
                <div className={styles.breakdownRow}>
                  <span>Shipping ({shippingMethod.carrier})</span>
                  <span>{shipping} USDC</span>
                </div>
                <div className={styles.breakdownRow}>
                  <span>Buyer protection (5%)</span>
                  <span>{fee} USDC</span>
                </div>
                <div className={`${styles.breakdownRow} ${styles.breakdownTotal}`}>
                  <span>Total</span>
                  <span>{total} USDC</span>
                </div>
              </div>

              <div className={styles.trustPanel} aria-label="Escrow policy">
                <div className={styles.trustHeader}>
                  <span className={styles.cardKicker}>Escrow policy</span>
                  <strong>Funds move after delivery</strong>
                </div>
                <ol className={styles.policySteps}>
                  {ESCROW_POLICY_STEPS.map((step, index) => (
                    <li key={step.title}>
                      <span className={styles.stepNumber}>{index + 1}</span>
                      <div>
                        <strong>{step.title}</strong>
                        <p>{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className={`${styles.roleNotice} ${noticeClassByTone[roleNotice.tone]}`}>
                  <div>
                    <strong>{roleNotice.title}</strong>
                    <p>{roleNotice.body}</p>
                  </div>
                  <span>{roleNotice.action}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className={styles.actions}>
                {listing.status === 'available' && !isOwner && connected && listing.listing_pda && (
                  <button
                    type="button"
                    className={`btn btn-primary btn-lg ${styles.fullWidth}`}
                    onClick={() => setReviewAction('buy')}
                  >
                    Buy now - {total} USDC
                  </button>
                )}

                {listing.status === 'available' && !isOwner && !connected && (
                  <p className={styles.connectHint}>Connect your wallet to purchase</p>
                )}

                {listing.status === 'available' && isOwner && listing.listing_pda && (
                  <button
                    type="button"
                    className={`btn btn-danger ${styles.fullWidth}`}
                    onClick={() => setReviewAction('cancelListing')}
                  >
                    Cancel listing
                  </button>
                )}

                {listing.status === 'in_escrow' && isBuyer && (
                  <div className={styles.actionGroup}>
                    <button
                      type="button"
                      className={`btn btn-primary btn-lg ${styles.splitAction}`}
                      onClick={() => setReviewAction('confirm')}
                    >
                      Confirm receipt
                    </button>
                    <button
                      type="button"
                      className={`btn btn-danger ${styles.splitAction}`}
                      onClick={() => setReviewAction('cancelPurchase')}
                    >
                      Cancel purchase
                    </button>
                  </div>
                )}

                {listing.status === 'in_escrow' && isOwner && (
                  <div className={styles.escrowNotice}>
                    <span aria-hidden="true" />
                    <p>Waiting for buyer to confirm receipt. Add tracking once the package is moving.</p>
                  </div>
                )}

                {listing.status === 'sold' && (
                  <div className={styles.soldNotice}>
                    <span aria-hidden="true" />
                    <p>This item has been sold and delivered.</p>
                  </div>
                )}

                {!listing.listing_pda && listing.status === 'available' && (
                  <p className={styles.connectHint}>This listing has no on-chain PDA (demo mode)</p>
                )}
              </div>
            </div>

            {/* Description */}
            {listing.description && (
              <div className={styles.descSection}>
                <h3>Listing notes</h3>
                <p>{listing.description}</p>
              </div>
            )}

            {canViewShipping && (
              <section className={styles.shippingPanel} aria-label="Shipment tracking">
                <div className={styles.shippingHeader}>
                  <span className={styles.cardKicker}>Shipment</span>
                  {shipment?.tracking_number && (
                    <span className={styles.shippingBadge}>Tracking saved</span>
                  )}
                </div>

                {canEditShipping ? (
                  <form
                    className={styles.shippingForm}
                    onSubmit={saveShipping}
                    aria-describedby={shippingError ? 'shipping-error' : undefined}
                  >
                    <div className={styles.fieldRow}>
                      <div className={styles.fieldGroup}>
                        <label className="input-label" htmlFor="shipping-carrier">
                          Carrier
                        </label>
                        <select
                          id="shipping-carrier"
                          className="input-field select-field"
                          value={shippingForm.carrier}
                          onChange={(event) => {
                            setShippingError(undefined);
                            setShippingForm((prev) => ({ ...prev, carrier: event.target.value }));
                          }}
                          autoComplete="organization"
                        >
                          {SHIPPING_CARRIER_OPTIONS.map((carrier) => (
                            <option key={carrier} value={carrier}>
                              {carrier}
                            </option>
                          ))}
                          {!SHIPPING_CARRIER_OPTIONS.includes(shippingForm.carrier) && shippingForm.carrier && (
                            <option value={shippingForm.carrier}>{shippingForm.carrier}</option>
                          )}
                        </select>
                      </div>

                      <div className={styles.fieldGroup}>
                        <label className="input-label" htmlFor="shipping-tracking">
                          Tracking number
                        </label>
                        <input
                          id="shipping-tracking"
                          className="input-field"
                          type="text"
                          value={shippingForm.trackingNumber}
                          onChange={(event) => {
                            setShippingError(undefined);
                            setShippingForm((prev) => ({
                              ...prev,
                              trackingNumber: event.target.value,
                            }));
                          }}
                          placeholder="1Z..."
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </div>
                    </div>

                    {shippingError && (
                      <p id="shipping-error" className={styles.shippingError} role="alert">
                        {shippingError}
                      </p>
                    )}

                    <button
                      type="submit"
                      className={`btn btn-secondary ${styles.shippingSubmit}`}
                      disabled={shippingSaving}
                      aria-busy={shippingSaving}
                    >
                      {shippingSaving ? (
                        <>
                          <span className="spinner" /> Saving tracking
                        </>
                      ) : shippingSaved ? (
                        'Tracking saved'
                      ) : (
                        'Save tracking'
                      )}
                    </button>
                  </form>
                ) : shipment ? (
                  <div className={styles.shippingSummary}>
                    <div>
                      <span>Carrier</span>
                      <strong>{shipment.carrier}</strong>
                    </div>
                    <div>
                      <span>Tracking</span>
                      <strong>{shipment.tracking_number}</strong>
                    </div>
                    {shipment.shipped_at && (
                      <p>
                        Shipped{' '}
                        {new Intl.DateTimeFormat(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }).format(new Date(shipment.shipped_at))}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className={styles.shippingEmpty}>
                    <span aria-hidden="true" />
                    <p>Tracking has not been added yet. Wait for shipment details before confirming receipt.</p>
                  </div>
                )}
              </section>
            )}

            <section className={styles.disputePanel} aria-label="Dispute and timeout policy">
              <div className={styles.disputeHeader}>
                <div>
                  <span className={styles.cardKicker}>What happens next</span>
                  <h3>{disputeGuidance.title}</h3>
                </div>
                <span className={`${styles.policyBadge} ${noticeClassByTone[disputeGuidance.tone]}`}>
                  {disputeGuidance.action}
                </span>
              </div>
              <p className={styles.disputeBody}>{disputeGuidance.body}</p>

              <ol className={styles.disputeTimeline}>
                {disputeTimeline.map((step, index) => (
                  <li key={step.title}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{step.title}</strong>
                      <p>{step.body}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <p className={styles.policyLimit}>
                {DISPUTE_POLICY.limitation}
              </p>
            </section>

            <div className={styles.sellerInfo} aria-label="Seller wallet">
              <div className={styles.sellerAvatar}>
                {listing.seller_wallet.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <span className={styles.sellerLabel}>Seller</span>
                <a
                  className={styles.sellerAddress}
                  href={buildSolscanAddressUrl(listing.seller_wallet)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {truncateAddress(listing.seller_wallet)}
                  <span className={styles.externalMark} aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
