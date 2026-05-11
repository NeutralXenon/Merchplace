'use client';

import React, { useEffect } from 'react';
import {
  getClusterLabel,
  getSolanaCluster,
  truncateAddress,
} from '@/lib/solanaDisplay';
import styles from './TransactionReviewModal.module.css';

export type ReviewLine = {
  label: string;
  value: string;
  tone?: 'default' | 'muted' | 'success' | 'danger';
};

type Props = {
  open: boolean;
  title: string;
  subtitle: string;
  actionLabel: string;
  lines: ReviewLine[];
  checklist?: string[];
  riskNotes?: string[];
  walletAddress?: string;
  counterpartyAddress?: string;
  programLabel?: string;
  danger?: boolean;
  isBusy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function TransactionReviewModal({
  open,
  title,
  subtitle,
  actionLabel,
  lines,
  checklist = [],
  riskNotes = [],
  walletAddress,
  counterpartyAddress,
  programLabel = 'Merchplace escrow',
  danger = false,
  isBusy = false,
  onCancel,
  onConfirm,
}: Props) {
  const cluster = getSolanaCluster();

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isBusy) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBusy, onCancel, open]);

  if (!open) return null;

  return (
    <div className={styles.overlay}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tx-review-title"
      >
        <div className={styles.header}>
          <span className={styles.kicker}>Review before signing</span>
          <h2 id="tx-review-title">{title}</h2>
          <p>{subtitle}</p>
        </div>

        <div className={styles.metaGrid}>
          <div>
            <span>Network</span>
            <strong>{getClusterLabel(cluster)}</strong>
          </div>
          <div>
            <span>Program</span>
            <strong>{programLabel}</strong>
          </div>
          {walletAddress && (
            <div>
              <span>Signer</span>
              <strong className={styles.address}>{truncateAddress(walletAddress)}</strong>
            </div>
          )}
          {counterpartyAddress && (
            <div>
              <span>Counterparty</span>
              <strong className={styles.address}>{truncateAddress(counterpartyAddress)}</strong>
            </div>
          )}
        </div>

        <div className={styles.lines}>
          {lines.map((line) => (
            <div key={line.label} className={`${styles.line} ${line.tone ? styles[line.tone] : ''}`}>
              <span>{line.label}</span>
              <strong>{line.value}</strong>
            </div>
          ))}
        </div>

        {checklist.length > 0 && (
          <div className={styles.checklist}>
            <span className={styles.kicker}>Escrow checks</span>
            <ul>
              {checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {riskNotes.length > 0 && (
          <div className={styles.riskNotes}>
            <span className={styles.kicker}>Policy limits</span>
            <ul>
              {riskNotes.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <p className={styles.note}>
          Your wallet will still show its own approval screen. Do not sign if the wallet details differ from this review.
        </p>

        <div className={styles.actions}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={isBusy}
          >
            Back
          </button>
          <button
            type="button"
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            disabled={isBusy}
            aria-busy={isBusy}
          >
            {isBusy ? (
              <>
                <span className="spinner" /> Preparing
              </>
            ) : (
              actionLabel
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
