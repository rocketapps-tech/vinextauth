'use client';

import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { source } from '@/lib/source';
import { LangSwitch } from '@/components/lang-switch';
import { Logo } from '@/components/logo';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: <Logo height={26} />,
        url: '/',
      }}
      links={[
        {
          text: 'GitHub',
          url: 'https://github.com/rocketapps-tech/vinextauth',
          external: true,
        },
      ]}
      sidebar={{
        footer: <LangSwitch />,
      }}
    >
      {children}
    </DocsLayout>
  );
}
