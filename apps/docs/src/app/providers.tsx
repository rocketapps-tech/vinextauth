"use client";

import { RootProvider as FumaRootProvider } from "fumadocs-ui/provider/base";
import { FrameworkProvider } from "fumadocs-core/framework";
import {
  usePathname,
  useRouter,
  useParams,
} from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <FrameworkProvider
      usePathname={usePathname}
      useRouter={useRouter}
      useParams={useParams}
      Link={Link}
      Image={Image}
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
