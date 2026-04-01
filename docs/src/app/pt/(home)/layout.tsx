import { Navbar } from '@/components/navbar';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar homeHref="/pt" docsHref="/pt/docs" />
      <main>{children}</main>
    </>
  );
}
