import Link from "next/link";

const features = [
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}>
        <path fillRule="evenodd" d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093Z" clipRule="evenodd" />
      </svg>
    ),
    title: "Edge-first",
    description: "Runs natively on Cloudflare Workers. No Node.js APIs — pure Web Crypto everywhere.",
  },
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}>
        <path d="M10.362 1.093a.75.75 0 0 0-.724 0L2.523 5.018 10 9.143l7.477-4.125-7.115-3.925ZM18 6.443l-7.25 4v8.25l6.862-3.786A.75.75 0 0 0 18 14.25V6.443ZM9.25 18.693v-8.25l-7.25-4v7.807a.75.75 0 0 0 .388.657l6.862 3.786Z" />
      </svg>
    ),
    title: "Zero dependencies",
    description: "No runtime dependencies. JWT, CSRF, cookies and crypto are all hand-rolled.",
  },
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}>
        <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z" clipRule="evenodd" />
      </svg>
    ),
    title: "NextAuth v4 compatible",
    description: "Same callbacks, same session shape, same cookie format. Drop-in replacement.",
  },
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}>
        <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
      </svg>
    ),
    title: "12 providers",
    description: "Google, GitHub, Discord, Apple, Microsoft and more. Plus credentials and magic link email.",
  },
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}>
        <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3Z" />
        <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7Z" />
        <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3Z" />
      </svg>
    ),
    title: "Cloudflare adapters",
    description: "KV and D1 adapters for database sessions and server-side invalidation.",
  },
  {
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width={20} height={20}>
        <path fillRule="evenodd" d="M9.661 2.237a.531.531 0 0 1 .678 0 11.947 11.947 0 0 0 7.078 2.749.5.5 0 0 1 .479.425c.069.52.104 1.05.104 1.59 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 0 1-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 0 1 .48-.425 11.947 11.947 0 0 0 7.077-2.75Zm4.196 5.954a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clipRule="evenodd" />
      </svg>
    ),
    title: "CSRF + rate limiting",
    description: "Built-in double-submit CSRF protection and configurable credentials rate limiting.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="lp-hero">
        <div className="lp-badge">
          <span className="lp-badge-dot" />
          Drop-in NextAuth v4 replacement
        </div>

        <h1 className="lp-title">
          {"Auth for "}
          <span className="lp-title-accent">Vinext</span>
          {" & "}
          <span className="lp-title-accent">Cloudflare Workers</span>
        </h1>

        <p className="lp-description">
          VinextAuth is a zero-dependency authentication library built on the
          Web Crypto API. Same API as NextAuth v4, but runs anywhere at the edge.
        </p>

        <div className="lp-actions">
          <Link href="/docs" className="lp-btn-primary">
            Get Started
          </Link>
          <a
            href="https://github.com/rocketapps-tech/vinextauth"
            target="_blank"
            rel="noopener noreferrer"
            className="lp-btn-secondary"
          >
            GitHub
          </a>
        </div>

        <div className="lp-install">
          <span className="lp-install-prompt">$ </span>
          <span>npm install vinextauth</span>
        </div>
      </section>

      {/* Features grid */}
      <section className="lp-section">
        <div className="lp-grid">
          {features.map((f) => (
            <div key={f.title} className="lp-card">
              <div className="lp-card-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick example */}
      <section className="lp-section">
        <div className="lp-code-wrap">
          <h2 className="lp-section-title">Get running in minutes</h2>
          <p className="lp-section-sub">Works with your existing NextAuth config.</p>

          <div className="lp-code-block">
            <div className="lp-code-header">src/auth.ts</div>
            <pre>{`import VinextAuth from "vinextauth";
import Google from "vinextauth/providers/google";
import GitHub from "vinextauth/providers/github";

export const { GET, POST, auth, toPages } = VinextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      session.user.id = token.sub;
      return session;
    },
  },
});`}</pre>
          </div>

          <Link href="/docs/getting-started" className="lp-link">
            See the full setup guide &rarr;
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="lp-footer">
        {"MIT License · "}
        <a href="https://github.com/rocketapps-tech/vinextauth">GitHub</a>
        {" · Built for "}
        <a href="https://vinext.io">Vinext</a>
        {" & Cloudflare Workers"}
      </footer>
    </>
  );
}
