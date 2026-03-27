import type { ReactNode } from "react";

export const metadata = {
  title: {
    default: "VinextAuth",
    template: "%s — VinextAuth",
  },
  description:
    "Substituto drop-in do NextAuth v4 para Vinext + Cloudflare Workers. Zero dependências Node.js, Web Crypto API pura.",
  openGraph: {
    type: "website",
    siteName: "VinextAuth",
    title: "VinextAuth — Auth para Vinext & Cloudflare Workers",
    description:
      "Substituto drop-in do NextAuth v4. Zero dependências, Web Crypto API pura.",
    images: [{ url: "/logo.png", width: 320, height: 64 }],
  },
};

// Segments under /pt override lang to pt-BR
export default function PtLayout({ children }: { children: ReactNode }) {
  return <div lang="pt-BR">{children}</div>;
}
