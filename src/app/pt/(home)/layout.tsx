'use client';

import { HomeLayout } from 'fumadocs-ui/layouts/home';
import { LangSwitch } from '@/components/lang-switch';
import type { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <HomeLayout
      nav={{
        title: (
          <img src="/logo.svg" alt="VinextAuth" height={28} style={{ height: 28, width: 'auto' }} />
        ),
        url: '/pt',
        children: <LangSwitch />,
      }}
      links={[
        { text: 'Docs', url: '/pt/docs' },
        {
          text: 'GitHub',
          url: 'https://github.com/rocketapps-tech/vinextauth',
          external: true,
        },
      ]}
    >
      {children}
    </HomeLayout>
  );
}
