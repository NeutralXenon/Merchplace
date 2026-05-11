'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { getClusterLabel, getSolanaCluster } from '@/lib/solanaDisplay';
import styles from './Navbar.module.css';

export function Navbar() {
  const { connected } = useWallet();
  const pathname = usePathname();
  const cluster = getSolanaCluster();
  const clusterClass = {
    devnet: styles.networkDevnet,
    testnet: styles.networkTestnet,
    'mainnet-beta': styles.networkMainnet,
    localnet: styles.networkLocalnet,
  }[cluster];
  const links = [
    { href: '/', label: 'Browse' },
    { href: '/listing/create', label: 'Sell' },
    ...(connected ? [{ href: '/profile', label: 'Profile' }] : []),
  ];

  return (
    <nav className={styles.nav}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          <Image
            src="/merchplace-artifact-logo.svg"
            alt=""
            aria-hidden="true"
            width={36}
            height={36}
            className={styles.logoMark}
            priority
          />
          <span className={styles.logoText}>Merchplace</span>
        </Link>

        <div className={styles.links}>
          {links.map((link) => {
            const isActive =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`${styles.link} ${isActive ? styles.linkActive : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className={styles.actions}>
          <span className={`${styles.networkBadge} ${clusterClass}`}>
            {getClusterLabel(cluster)}
          </span>
          <WalletMultiButton className={styles.walletBtn} />
        </div>
      </div>
    </nav>
  );
}
