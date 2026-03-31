import { Navbar } from '@/components/navbar';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar homeHref="/" docsHref="/docs" />
      <main>{children}</main>
    </>
  );
}
