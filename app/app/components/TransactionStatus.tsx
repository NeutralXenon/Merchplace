'use client';

import React from 'react';
import {
  buildSolscanTxUrl,
  canOpenSolscan,
  getSolanaCluster,
  truncateAddress,
} from '@/lib/solanaDisplay';
import styles from './TransactionStatus.module.css';

export type TxStatus =
  | 'idle'
  | 'signing'
  | 'funding'
  | 'uploading'
  | 'sending'
  | 'confirming'
  | 'syncing'
  | 'success'
  | 'syncError'
  | 'error';

type Props = {
  status: TxStatus;
  signature?: string;
  errorMessage?: string;
  onClose?: () => void;
  actionLabel?: string;
  onAction?: () => void;
  actionBusy?: boolean;
};

const STATUS_LABELS: Record<TxStatus, string> = {
  idle: '',
  signing: 'Waiting for wallet approval',
  funding: 'Funding local wallet',
  uploading: 'Uploading photos',
  sending: 'Sending transaction',
  confirming: 'Confirming on-chain',
  syncing: 'Syncing listing',
  success: 'Listing is live',
  syncError: 'Listing needs sync',
  error: 'Transaction failed',
};

export function TransactionStatus({
  status,
  signature,
  errorMessage,
  onClose,
  actionLabel,
  onAction,
  actionBusy = false,
}: Props) {
  if (status === 'idle') return null;

  const isBusy =
    status === 'signing' ||
    status === 'funding' ||
    status === 'uploading' ||
    status === 'sending' ||
    status === 'confirming' ||
    status === 'syncing';
  const canClose = (status === 'success' || status === 'error' || status === 'syncError') && onClose;
  const cluster = getSolanaCluster();
  const solscanTxUrl =
    signature && canOpenSolscan(cluster)
      ? buildSolscanTxUrl(signature, cluster)
      : null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="tx-status-title">
        <div className={`${styles.iconContainer} ${styles[status]}`}>
          {isBusy ? (
            <div className={styles.spinnerLarge} />
          ) : (
            <span className={`${styles.icon} ${styles[status]}`} aria-hidden="true" />
          )}
        </div>

        <p id="tx-status-title" className={`${styles.label} ${styles[status]}`}>
          {STATUS_LABELS[status]}
        </p>

        {errorMessage && (
          <p className={styles.errorMsg}>{errorMessage}</p>
        )}

        {signature && solscanTxUrl && (
          <a
            href={solscanTxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.txLink}
          >
            <span>View transaction</span>
            <span className={styles.externalMark} aria-hidden="true" />
          </a>
        )}

        {signature && !solscanTxUrl && (
          <div className={styles.localTx}>
            <span>Localnet transaction</span>
            <code title={signature}>{truncateAddress(signature, 6)}</code>
          </div>
        )}

        {onAction && status === 'syncError' && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={onAction}
            disabled={actionBusy}
            aria-busy={actionBusy}
          >
            {actionBusy ? (
              <>
                <span className="spinner" /> Retrying
              </>
            ) : (
              actionLabel ?? 'Retry sync'
            )}
          </button>
        )}

        {canClose && (
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {status === 'success' ? 'Done' : 'Close'}
          </button>
        )}
      </div>
    </div>
  );
}
