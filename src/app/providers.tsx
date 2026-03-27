"use client";

import { RootProvider as FumaRootProvider } from "fumadocs-ui/provider/base";
import { FrameworkProvider } from "fumadocs-core/framework";
import type { Framework } from "fumadocs-core/framework";
import {
  usePathname,
  useRouter,
  useParams,
} from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { FC } from "react";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <FrameworkProvider
      usePathname={usePathname}
      useRouter={useRouter}
      useParams={useParams}
      Link={Link as Framework["Link"]}
      Image={Image as FC<Parameters<NonNullable<Framework["Image"]>>[0]>}
    >
      <FumaRootProvider
        theme={{
          attribute: "class",
          defaultTheme: "light",
          disableTransitionOnChange: true,
        }}
      >
        {children}
      </FumaRootProvider>
    </FrameworkProvider>
  );
}
