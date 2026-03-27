"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const languages = [
  { code: "en", label: "EN", prefix: "/docs" },
  { code: "pt", label: "PT", prefix: "/pt/docs" },
] as const;

/**
 * Detects the current locale from the pathname and renders a language switcher.
 * /docs/...       → EN active
 * /pt/docs/...    → PT active
 * /               → EN active (home)
 * /pt             → PT active (home)
 */
export function LangSwitch() {
  const pathname = usePathname();
  const isPt = pathname.startsWith("/pt");

  // Map current path to the other locale
  function href(code: "en" | "pt") {
    if (code === "en") {
      // Strip /pt prefix
      const stripped = pathname.replace(/^\/pt/, "") || "/";
      return stripped;
    } else {
      // Add /pt prefix
      if (pathname === "/") return "/pt";
      return `/pt${pathname}`;
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
      {languages.map((lang) => {
        const active = lang.code === "pt" ? isPt : !isPt;
        return (
          <Link
            key={lang.code}
            href={href(lang.code)}
            style={{
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "12px",
              fontWeight: active ? 600 : 400,
              color: active ? "var(--color-fd-primary)" : "var(--color-fd-muted-foreground)",
              textDecoration: "none",
              background: active ? "var(--color-fd-primary-foreground, transparent)" : "transparent",
              border: active ? "1px solid var(--color-fd-border)" : "1px solid transparent",
            }}
          >
            {lang.label}
          </Link>
        );
      })}
    </div>
  );
}
