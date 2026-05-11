import Image from 'next/image';
import Link from 'next/link';
import { BrowseSection } from './components/BrowseSection';
import styles from './page.module.css';

export default function Home() {
  return (
    <>
      <section className={styles.marketHeader}>
        <div className="container">
          <div className={styles.headerGrid}>
            <div className={styles.headerCopy}>
              <div className={styles.heroBrand} aria-label="Merchplace">
                <Image
                  src="/merchplace-artifact-logo.svg"
                  alt=""
                  aria-hidden="true"
                  width={122}
                  height={122}
                  className={styles.heroLogoMark}
                  priority
                />
                <div className={styles.heroWordmark}>
                  <span>Merchplace</span>
                  <strong>Event merch, verified onchain</strong>
                </div>
              </div>
              <h1 className={styles.heroTitle}>
                Trade the merch people actually remember.
              </h1>
              <p className={styles.heroSubtitle}>
                Limited shirts, caps, bags, and conference pieces with USDC
                escrow, shipping costs, and buyer protection visible before
                checkout.
              </p>
              <div className={styles.heroActions}>
                <Link href="/listing/create" className="btn btn-primary btn-lg">
                  List merch
                </Link>
                <a href="#browse" className="btn btn-secondary btn-lg">
                  Browse latest
                </a>
              </div>
            </div>

            <aside className={styles.termsPanel} aria-label="Marketplace terms">
              <div className={styles.panelHeader}>
                <span>Escrow terms</span>
                <strong>5%</strong>
              </div>
              <dl className={styles.termList}>
                <div>
                  <dt>Buyer pays</dt>
                  <dd>Item + shipping + protection</dd>
                </div>
                <div>
                  <dt>Seller receives</dt>
                  <dd>Item price + shipping</dd>
                </div>
                <div>
                  <dt>Release</dt>
                  <dd>Funds settle after receipt confirmation</dd>
                </div>
              </dl>
            </aside>
          </div>
        </div>
      </section>

      <section id="browse" className={styles.browseSection}>
        <div className="container">
          <BrowseSection />
        </div>
      </section>
    </>
  );
}
