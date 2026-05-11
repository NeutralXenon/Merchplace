import type { Metadata } from 'next';
import './globals.css';
import { SolanaProviders } from './providers';
import { Navbar } from './components/Navbar';

export const metadata: Metadata = {
  title: 'Merchplace — Solana Event Merch Marketplace',
  description:
    'Buy and sell event merchandise from Solana conferences, hackathons, and meetups with USDC escrow.',
  keywords: ['Solana', 'marketplace', 'merch', 'crypto', 'USDC', 'Breakpoint'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <SolanaProviders>
          <Navbar />
          <main className="app-main">{children}</main>
        </SolanaProviders>
      </body>
    </html>
  );
}
