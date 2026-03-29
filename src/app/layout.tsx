import { Providers } from './providers';
import type { ReactNode } from 'react';
import 'fumadocs-ui/style.css';
import './globals.css';

export const metadata = {
  title: {
    default: 'VinextAuth',
    template: '%s — VinextAuth',
  },
  description:
    'Drop-in NextAuth v4 replacement for Vinext + Cloudflare Workers. Zero Node.js dependencies, pure Web Crypto API.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon.png', type: 'image/png', sizes: '64x64' },
      { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
  },
  openGraph: {
    type: 'website',
    siteName: 'VinextAuth',
    title: 'VinextAuth — Auth for Vinext & Cloudflare Workers',
    description: 'Drop-in NextAuth v4 replacement. Zero dependencies, pure Web Crypto API.',
    images: [{ url: '/logo.png', width: 320, height: 64 }],
  },
  twitter: {
    card: 'summary',
    title: 'VinextAuth',
    description: 'Drop-in NextAuth v4 replacement for Cloudflare Workers.',
    images: ['/logo.png'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
