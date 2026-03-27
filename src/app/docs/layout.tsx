"use client";

import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { source } from "@/lib/source";
import { LangSwitch } from "@/components/lang-switch";
import type { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: (
          <img
            src="/logo.svg"
            alt="VinextAuth"
            height={28}
            style={{ height: 28, width: "auto" }}
          />
        ),
        url: "/",
      }}
      links={[
        {
          text: "GitHub",
          url: "https://github.com/rocketapps-tech/vinextauth",
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
