'use client';

import React, { useState, useRef, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { ensureWalletSession } from '@/lib/authClient';
import { useProgram, createListingOnChain, BN } from '@/lib/program';
import {
  createListing as createListingApi,
  uploadImages,
  type CreateListingPayload,
} from '@/lib/api';
import { getErrorMessage, getWalletErrorMessage } from '@/lib/errors';
import { saveLocalListing } from '@/lib/localListings';
import {
  formatUsdcMicro,
  getMarketplaceTotals,
} from '@/lib/solanaDisplay';
import { DEFAULT_SHIPPING_METHOD, SHIPPING_METHODS, getShippingMethod } from '@/lib/shippingMethods';
import { TransactionStatus, TxStatus } from '../../components/TransactionStatus';
import { TransactionReviewModal, ReviewLine } from '../../components/TransactionReviewModal';
import {
  ensureWalletHasFeeLamports,
  getWalletFundingErrorMessage,
  isNoPriorCreditError,
} from '@/lib/walletFunding';
import styles from './page.module.css';

const EVENTS = [
  'Breakpoint 2025',
  'Breakpoint 2024',
  'Colosseum 2025',
  'Hacker House Tokyo',
  'Superteam Summit',
  'Solana Crossroads',
  'Other',
];

const CATEGORIES = ['T-Shirt', 'Hoodie', 'Cap', 'Jacket', 'Bag', 'Socks', 'Accessories', 'Other'];
const CONDITIONS = ['New', 'Like New', 'Good', 'Fair'];
const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'One Size'];

const MAX_PHOTOS = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

type ImagePreview = {
  file: File;
  url: string;
};

type PendingListingSync = {
  payload: CreateListingPayload;
  fallbackListingId: string;
};

export default function CreateListingPage() {
  const router = useRouter();
  const { connected, publicKey, signMessage } = useWallet();
  const { program, connection } = useProgram();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txSignature, setTxSignature] = useState<string>();
  const [txError, setTxError] = useState<string>();
  const [createdListingId, setCreatedListingId] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [pendingSync, setPendingSync] = useState<PendingListingSync | null>(null);
  const [isSyncRetrying, setIsSyncRetrying] = useState(false);
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    eventName: EVENTS[0],
    category: CATEGORIES[0],
    condition: CONDITIONS[0],
    size: SIZES[3],
    price: '',
    shippingMethodId: DEFAULT_SHIPPING_METHOD.id,
  });

  const updateField = (field: string, value: string) => {
    setFormError(undefined);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // --- Photo Upload Logic ---
  const processFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const remaining = MAX_PHOTOS - images.length;
      if (remaining <= 0) return;

      const validFiles = fileArray
        .filter((f) => f.type.startsWith('image/'))
        .filter((f) => f.size <= MAX_FILE_SIZE)
        .slice(0, remaining);

      if (validFiles.length === 0) return;

      const newPreviews: ImagePreview[] = validFiles.map((file) => ({
        file,
        url: URL.createObjectURL(file),
      }));

      setImages((prev) => [...prev, ...newPreviews]);
    },
    [images.length]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
      e.target.value = ''; // reset so same file can be re-selected
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.url);
      return prev.filter((_, i) => i !== index);
    });
  };

  const validatePricing = () => {
    const priceValue = Number.parseFloat(form.price);
    const shippingMethod = getShippingMethod(form.shippingMethodId);
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      setFormError('Enter an item price greater than 0 USDC.');
      return null;
    }
    if (!shippingMethod) {
      setFormError('Choose a carrier shipping method.');
      return null;
    }

    return { priceValue, shippingMethod };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !publicKey || !program) return;
    if (!validatePricing()) return;
    setReviewOpen(true);
  };

  const syncListingMetadata = async (
    payload: CreateListingPayload,
    fallbackListingId: string
  ) => {
    const saved = await createListingApi(payload);
    setCreatedListingId(saved.id || fallbackListingId);
    saveLocalListing(saved);
  };

  const retryMetadataSync = async () => {
    if (!pendingSync) return;

    setIsSyncRetrying(true);
    setTxStatus('syncing');
    setTxError(undefined);

    try {
      await syncListingMetadata(pendingSync.payload, pendingSync.fallbackListingId);
      setPendingSync(null);
      setTxStatus('success');
    } catch (err: unknown) {
      setTxError(
        `On-chain listing succeeded, but Supabase sync failed: ${getErrorMessage(err, 'Metadata sync failed')}`
      );
      setTxStatus('syncError');
    } finally {
      setIsSyncRetrying(false);
    }
  };

  const publishListing = async () => {
    if (!connected || !publicKey || !program) return;
    const pricing = validatePricing();
    if (!pricing) return;

    const { priceValue, shippingMethod } = pricing;

    setReviewOpen(false);
    setIsSubmitting(true);
    setTxStatus('signing');
    setTxSignature(undefined);
    setTxError(undefined);

    try {
      await ensureWalletSession(publicKey, signMessage);
      setTxStatus('funding');
      await ensureWalletHasFeeLamports(connection, publicKey);

      const priceUsdc = Math.round(priceValue * 1_000_000);
      const shippingUsdc = shippingMethod.priceMicro;
      const listingId = new BN(Date.now());

      let imageUrls: string[] = [];
      if (images.length > 0) {
        setTxStatus('uploading');
        try {
          imageUrls = await uploadImages(
            images.map((img) => img.file), publicKey.toBase58()
          );
        } catch (err: unknown) {
          throw new Error(
            `Image upload failed before on-chain publish: ${getErrorMessage(err, 'Upload failed')}`
          );
        }
      }

      // Create metadata hash
      const metadataStr = JSON.stringify({
        title: form.title, description: form.description,
        eventName: form.eventName, category: form.category,
        condition: form.condition, size: form.size,
        shippingMethod: {
          id: shippingMethod.id,
          carrier: shippingMethod.carrier,
          service: shippingMethod.service,
        },
        images: imageUrls,
      });
      const encodedMeta = new TextEncoder().encode(metadataStr);
      const hashBuffer = await crypto.subtle.digest(
        'SHA-256', encodedMeta as Uint8Array<ArrayBuffer>
      );
      const metadataHash = Array.from(new Uint8Array(hashBuffer));

      // 1. On-chain listing
      setTxStatus('sending');
      const { tx, listingPda } = await createListingOnChain(
        program, publicKey, listingId,
        new BN(priceUsdc), metadataHash, new BN(shippingUsdc)
      );
      setTxSignature(tx);
      setTxStatus('confirming');

      // 2. Save metadata only after the backend verifies the on-chain listing.
      const listingPayload: CreateListingPayload = {
        seller_wallet: publicKey.toBase58(),
        listing_id: listingId.toNumber(),
        listing_pda: listingPda,
        title: form.title,
        description: form.description,
        event_name: form.eventName,
        category: form.category,
        condition: form.condition,
        size: form.size,
        price_usdc: priceUsdc,
        shipping_cost: shippingUsdc,
        shipping_method: shippingMethod.id,
        images: imageUrls,
        tx_signature: tx,
        metadata_hash: Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, '0')).join(''),
      };

      setPendingSync({ payload: listingPayload, fallbackListingId: listingPda });
      setTxStatus('syncing');

      try {
        await syncListingMetadata(listingPayload, listingPda);
        setPendingSync(null);
        setTxStatus('success');
      } catch (err: unknown) {
        setTxError(
          `On-chain listing succeeded, but Supabase sync failed: ${getErrorMessage(err, 'Metadata sync failed')}`
        );
        setTxStatus('syncError');
      }
    } catch (err: unknown) {
      console.error('Create listing error:', err);
      setTxError(
        isNoPriorCreditError(err)
          ? getWalletFundingErrorMessage(
              process.env.NEXT_PUBLIC_SOLANA_NETWORK || connection.rpcEndpoint
            )
          : getWalletErrorMessage(err, 'Failed to create listing')
      );
      setTxStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!connected) {
    return (
      <div className={styles.connectPrompt}>
        <div className={styles.promptContent}>
          <span className={styles.promptIcon} aria-hidden="true" />
          <h2>Connect before listing</h2>
          <p>Your wallet signs the escrow listing and receives the sale proceeds.</p>
        </div>
      </div>
    );
  }

  const priceNumber = Number.parseFloat(form.price) || 0;
  const priceMicro = Math.round(priceNumber * 1_000_000);
  const selectedShipping = getShippingMethod(form.shippingMethodId) ?? DEFAULT_SHIPPING_METHOD;
  const shippingMicro = selectedShipping.priceMicro;
  const totals = getMarketplaceTotals(priceMicro, shippingMicro);
  const buyerProtection = formatUsdcMicro(totals.buyerProtectionMicro);
  const buyerPays = formatUsdcMicro(totals.buyerPaysMicro);
  const sellerReceives = formatUsdcMicro(totals.sellerReceivesMicro);
  const canSubmit =
    !isSubmitting &&
    form.title.trim().length > 0 &&
    form.description.trim().length > 0 &&
    priceNumber > 0;
  const reviewLines: ReviewLine[] = [
    { label: 'Item price', value: `${formatUsdcMicro(totals.itemMicro)} USDC` },
    {
      label: `Shipping (${selectedShipping.carrier})`,
      value: `${formatUsdcMicro(totals.shippingMicro)} USDC`,
    },
    { label: 'Buyer protection', value: `${buyerProtection} USDC` },
    { label: 'Buyer sees', value: `${buyerPays} USDC`, tone: 'success' },
    { label: 'You receive', value: `${sellerReceives} USDC`, tone: 'success' },
  ];

  return (
    <>
    <TransactionReviewModal
      open={reviewOpen}
      title="Review listing"
      subtitle="Publishing creates the escrow listing on-chain. Buyers will see this price breakdown before they sign."
      actionLabel="Sign publish"
      lines={reviewLines}
      walletAddress={publicKey?.toBase58()}
      onCancel={() => setReviewOpen(false)}
      onConfirm={publishListing}
      isBusy={isSubmitting}
    />
    <TransactionStatus
      status={txStatus}
      signature={txSignature}
      errorMessage={txError}
      actionLabel="Retry Supabase sync"
      onAction={pendingSync ? retryMetadataSync : undefined}
      actionBusy={isSyncRetrying}
      onClose={() => {
        setTxStatus('idle');
        if (txStatus === 'success') {
          setForm({
            title: '',
            description: '',
            eventName: EVENTS[0],
            category: CATEGORIES[0],
            condition: CONDITIONS[0],
            size: SIZES[3],
            price: '',
            shippingMethodId: DEFAULT_SHIPPING_METHOD.id,
          });
          setImages([]);
          if (createdListingId) {
            router.push(`/listing/${createdListingId}`);
          }
        }
      }}
    />
    <div className={styles.page}>
      <header className={styles.header}>
        <span className={styles.eyebrow}>Sell desk</span>
        <h1 className={styles.title}>List a piece of Solana event history</h1>
        <p className={styles.subtitle}>
          Add crisp details, set a USDC price, and publish through wallet-signed escrow.
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className={styles.form}
        aria-describedby={formError ? 'listing-form-error' : undefined}
      >
        <div className={styles.formMain}>
          <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>Photos</legend>
            <p className={styles.sectionIntro}>
              Lead with the tag, print, or venue detail that makes the piece recognizable.
            </p>

            {images.length > 0 && (
              <div className={styles.imageGrid}>
                {images.map((img, i) => (
                  <div key={i} className={styles.imagePreview}>
                    <Image
                      src={img.url}
                      alt={`Listing photo ${i + 1}`}
                      className={styles.formImage}
                      fill
                      sizes="116px"
                      unoptimized
                    />
                    <button
                      type="button"
                      className={styles.removeBtn}
                      onClick={() => removeImage(i)}
                      aria-label={`Remove photo ${i + 1}`}
                    >
                      <span className={styles.removeGlyph} aria-hidden="true" />
                    </button>
                    {i === 0 && <span className={styles.coverLabel}>Cover</span>}
                  </div>
                ))}
              </div>
            )}

            {images.length < MAX_PHOTOS && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                  className={styles.fileInput}
                  id="photo-upload"
                />
                <button
                  type="button"
                  className={`${styles.imageUpload} ${dragActive ? styles.imageUploadActive : ''}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  aria-controls="photo-upload"
                >
                  <span className={styles.uploadIcon} aria-hidden="true" />
                  <span className={styles.uploadCopy}>
                    <strong>Add listing photos</strong>
                    <span>
                      {images.length}/{MAX_PHOTOS} photos, max 5MB each, JPG, PNG, WebP, or AVIF.
                    </span>
                  </span>
                </button>
              </>
            )}
          </fieldset>

          <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>Item details</legend>
            <p className={styles.sectionIntro}>
              Specifics help collectors compare drops without messaging first.
            </p>

            <div className={styles.fieldGroup}>
              <label className="input-label" htmlFor="listing-title">
                Title
              </label>
              <input
                id="listing-title"
                className="input-field"
                type="text"
                placeholder="Breakpoint 2025 staff hoodie"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
              />
            </div>

            <div className={styles.fieldGroup}>
              <label className="input-label" htmlFor="listing-description">
                Description
              </label>
              <textarea
                id="listing-description"
                className="input-field"
                placeholder="Mention wear, flaws, authenticity details, and what ships with it."
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                required
              />
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className="input-label" htmlFor="listing-event">
                  Event
                </label>
                <select
                  id="listing-event"
                  className="input-field select-field"
                  value={form.eventName}
                  onChange={(e) => updateField('eventName', e.target.value)}
                >
                  {EVENTS.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className="input-label" htmlFor="listing-category">
                  Category
                </label>
                <select
                  id="listing-category"
                  className="input-field select-field"
                  value={form.category}
                  onChange={(e) => updateField('category', e.target.value)}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.fieldRow}>
              <div className={styles.fieldGroup}>
                <label className="input-label" htmlFor="listing-condition">
                  Condition
                </label>
                <select
                  id="listing-condition"
                  className="input-field select-field"
                  value={form.condition}
                  onChange={(e) => updateField('condition', e.target.value)}
                >
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label className="input-label" htmlFor="listing-size">
                  Size
                </label>
                <select
                  id="listing-size"
                  className="input-field select-field"
                  value={form.size}
                  onChange={(e) => updateField('size', e.target.value)}
                >
                  {SIZES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>Pricing</legend>
            <p className={styles.sectionIntro}>
              Buyers see item price, carrier shipping, and the 5% protection fee before signing.
            </p>

            <div className={styles.fieldGroup}>
              <label className="input-label" htmlFor="listing-price">
                Item price
              </label>
              <div className={styles.priceInput}>
                <input
                  id="listing-price"
                  className="input-field"
                  type="text"
                  inputMode="decimal"
                  pattern="^[0-9]+(\\.[0-9]{0,2})?$"
                  placeholder="0.00"
                  value={form.price}
                  onChange={(e) => updateField('price', e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  required
                />
                <span className={styles.priceSuffix}>USDC</span>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <span className="input-label" id="listing-shipping-label">
                Shipping method
              </span>
              <div
                className={styles.shippingOptions}
                role="radiogroup"
                aria-labelledby="listing-shipping-label"
              >
                {SHIPPING_METHODS.map((method) => {
                  const checked = form.shippingMethodId === method.id;

                  return (
                    <label
                      key={method.id}
                      className={`${styles.shippingOption} ${
                        checked ? styles.shippingOptionSelected : ''
                      }`}
                      htmlFor={`shipping-${method.id}`}
                    >
                      <input
                        id={`shipping-${method.id}`}
                        className={styles.shippingRadio}
                        type="radio"
                        name="shipping-method"
                        value={method.id}
                        checked={checked}
                        onChange={(event) => updateField('shippingMethodId', event.target.value)}
                      />
                      <span className={styles.shippingOptionTop}>
                        <strong>{method.carrier}</strong>
                        <span>{formatUsdcMicro(method.priceMicro)} USDC</span>
                      </span>
                      <span className={styles.shippingService}>{method.service}</span>
                      <span className={styles.shippingMeta}>{method.eta}</span>
                      <span className={styles.shippingNote}>{method.note}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {formError && (
              <p id="listing-form-error" className={styles.formError} role="alert">
                {formError}
              </p>
            )}
          </fieldset>
        </div>

        <aside className={styles.rail} aria-label="Listing preview and escrow terms">
          <section className={styles.previewPanel}>
            <span className={styles.previewKicker}>Live preview</span>
            <div className={styles.previewPhoto}>
              {images[0] ? (
                <Image
                  src={images[0].url}
                  alt="Cover photo preview"
                  className={styles.formImage}
                  fill
                  sizes="360px"
                  unoptimized
                />
              ) : (
                <span className={styles.previewMark} aria-hidden="true" />
              )}
            </div>
            <h2>{form.title || 'Untitled merch drop'}</h2>
            <p>
              {form.eventName} / {form.category} / {form.condition}
              {form.size ? ` / ${form.size}` : ''}
            </p>
            <div className={styles.previewPrice}>
              <span>{formatUsdcMicro(totals.itemMicro)}</span>
              <span>USDC</span>
            </div>
            <p className={styles.previewShipping}>
              Ships with {selectedShipping.carrier} · {formatUsdcMicro(totals.shippingMicro)} USDC
            </p>
          </section>

          <section className={styles.termsPanel}>
            <h2>Escrow math</h2>
            <div className={styles.priceSummary}>
              <div className={styles.summaryRow}>
                <span>Item price</span>
                <span>{formatUsdcMicro(totals.itemMicro)} USDC</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Shipping ({selectedShipping.carrier})</span>
                <span>{formatUsdcMicro(totals.shippingMicro)} USDC</span>
              </div>
              <div className={styles.summaryRow}>
                <span>Buyer protection</span>
                <span>{buyerProtection} USDC</span>
              </div>
              <div className={`${styles.summaryRow} ${styles.summaryTotal}`}>
                <span>Buyer pays</span>
                <span>{buyerPays} USDC</span>
              </div>
              <div className={`${styles.summaryRow} ${styles.sellerReceives}`}>
                <span>You receive</span>
                <span>{sellerReceives} USDC</span>
              </div>
            </div>
          </section>

          <button
            type="submit"
            className={`btn btn-primary btn-lg ${styles.submitBtn}`}
            disabled={!canSubmit}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="spinner" /> Creating listing
              </>
            ) : (
              'Publish listing'
            )}
          </button>
        </aside>
      </form>
    </div>
    </>
  );
}
