import Link from 'next/link';
import { CodeTabs } from '@/components/code-tabs';
import { Logo } from '@/components/logo';
import pkg from '../../../../packages/vinext-auth/package.json';

/* ── Provider list ── */
const providers = [
  { name: 'Google', color: '#4285F4' },
  { name: 'GitHub', color: '#e4e4e7' },
  { name: 'Discord', color: '#5865F2' },
  { name: 'Apple', color: '#e4e4e7' },
  { name: 'Microsoft', color: '#00a1f1' },
  { name: 'Facebook', color: '#1877F2' },
  { name: 'LinkedIn', color: '#0A66C2' },
  { name: 'Twitch', color: '#9146FF' },
  { name: 'Spotify', color: '#1DB954' },
  { name: 'Twitter / X', color: '#e4e4e7' },
  { name: 'Credentials', color: '#a855f7' },
  { name: 'Magic Link', color: '#818cf8' },
];

/* ── Feature list ── */
const features = [
  {
    num: '01',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}>
        <path
          fillRule="evenodd"
          d="M11.983 1.907a.75.75 0 0 0-1.292-.657l-8.5 9.5A.75.75 0 0 0 2.75 12h6.572l-1.305 6.093a.75.75 0 0 0 1.292.657l8.5-9.5A.75.75 0 0 0 17.25 8h-6.572l1.305-6.093Z"
          clipRule="evenodd"
        />
      </svg>
    ),
    title: 'Edge-first runtime',
    description:
      'Runs natively on Cloudflare Workers with zero Node.js APIs. Pure Web Crypto everywhere — deploy to the global edge in seconds.',
  },
  {
    num: '02',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}>
        <path d="M10.362 1.093a.75.75 0 0 0-.724 0L2.523 5.018 10 9.143l7.477-4.125-7.115-3.925ZM18 6.443l-7.25 4v8.25l6.862-3.786A.75.75 0 0 0 18 14.25V6.443ZM9.25 18.693v-8.25l-7.25-4v7.807a.75.75 0 0 0 .388.657l6.862 3.786Z" />
      </svg>
    ),
    title: 'Zero dependencies',
    description:
      'No runtime packages. JWT signing, CSRF protection, cookie management and all cryptography are hand-rolled on platform APIs.',
  },
  {
    num: '03',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}>
        <path
          fillRule="evenodd"
          d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.989a.75.75 0 0 0-.75.75v4.242a.75.75 0 0 0 1.5 0v-2.43l.31.31a7 7 0 0 0 11.712-3.138.75.75 0 0 0-1.449-.39Zm1.23-3.723a.75.75 0 0 0 .219-.53V2.929a.75.75 0 0 0-1.5 0V5.36l-.31-.31A7 7 0 0 0 3.239 8.188a.75.75 0 1 0 1.448.389A5.5 5.5 0 0 1 13.89 6.11l.311.31h-2.432a.75.75 0 0 0 0 1.5h4.243a.75.75 0 0 0 .53-.219Z"
          clipRule="evenodd"
        />
      </svg>
    ),
    title: 'NextAuth v4 compatible',
    description:
      "Same callbacks, same session shape, same cookie format. Change one import and you're done — no refactoring required.",
  },
  {
    num: '04',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}>
        <path
          fillRule="evenodd"
          d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
          clipRule="evenodd"
        />
      </svg>
    ),
    title: '12 built-in providers',
    description:
      'Google, GitHub, Discord, Apple, Microsoft and more. Plus credentials sign-in and magic link email — all production-ready.',
  },
  {
    num: '05',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}>
        <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3Z" />
        <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7Z" />
        <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3Z" />
      </svg>
    ),
    title: 'Cloudflare KV + D1',
    description:
      'First-class adapters for Cloudflare KV and D1. Database sessions, server-side invalidation, and distributed rate limiting.',
  },
  {
    num: '06',
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}>
        <path
          fillRule="evenodd"
          d="M9.661 2.237a.531.531 0 0 1 .678 0 11.947 11.947 0 0 0 7.078 2.749.5.5 0 0 1 .479.425c.069.52.104 1.05.104 1.59 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 0 1-.332 0C5.26 16.564 2 12.163 2 7c0-.538.035-1.069.104-1.589a.5.5 0 0 1 .48-.425 11.947 11.947 0 0 0 7.077-2.75Zm4.196 5.954a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
          clipRule="evenodd"
        />
      </svg>
    ),
    title: 'CSRF + rate limiting',
    description:
      'Built-in double-submit CSRF protection and configurable in-memory rate limiting for the credentials provider.',
  },
];

/* ── Code examples ── */
const authTsCode = (
  <>
    <span className="t-kw">import</span>
    <span className="t-pl"> VinextAuth </span>
    <span className="t-kw">from</span>
    <span className="t-str"> &quot;vinextauth&quot;</span>
    <span className="t-pun">;</span>
    {'\n'}
    <span className="t-kw">import</span>
    <span className="t-pl"> Google </span>
    <span className="t-kw">from</span>
    <span className="t-str"> &quot;vinextauth/providers/google&quot;</span>
    <span className="t-pun">;</span>
    {'\n'}
    <span className="t-kw">import</span>
    <span className="t-pl"> GitHub </span>
    <span className="t-kw">from</span>
    <span className="t-str"> &quot;vinextauth/providers/github&quot;</span>
    <span className="t-pun">;</span>
    {'\n\n'}
    <span className="t-kw">export const</span>
    <span className="t-pl"> </span>
    <span className="t-pun">{'{'}</span>
    <span className="t-pl"> GET, POST, auth, toPages </span>
    <span className="t-pun">{'}'}</span>
    <span className="t-pl"> </span>
    <span className="t-pun">=</span>
    <span className="t-pl"> </span>
    <span className="t-fn">VinextAuth</span>
    <span className="t-pun">
      ({'('}
      {'{'}
    </span>
    {'\n'}
    <span className="t-pl">{'  '}providers</span>
    <span className="t-pun">: [</span>
    {'\n'}
    <span className="t-pl">{'    '}</span>
    <span className="t-fn">Google</span>
    <span className="t-pun">
      ({'('}
      {'{'}
    </span>
    {'\n'}
    <span className="t-pl">{'      '}clientId</span>
    <span className="t-pun">:</span>
    <span className="t-pl"> process</span>
    <span className="t-pun">.</span>
    <span className="t-pl">env</span>
    <span className="t-pun">.</span>
    <span className="t-pl">GOOGLE_CLIENT_ID</span>
    <span className="t-pun">!,</span>
    {'\n'}
    <span className="t-pl">{'      '}clientSecret</span>
    <span className="t-pun">:</span>
    <span className="t-pl"> process</span>
    <span className="t-pun">.</span>
    <span className="t-pl">env</span>
    <span className="t-pun">.</span>
    <span className="t-pl">GOOGLE_CLIENT_SECRET</span>
    <span className="t-pun">!,</span>
    {'\n'}
    <span className="t-pun">
      {'    '}
      {'}'}
      {')'},
    </span>
    {'\n'}
    <span className="t-pl">{'    '}</span>
    <span className="t-fn">GitHub</span>
    <span className="t-pun">
      ({'('}
      {'{'}
    </span>
    <span className="t-pl"> clientId</span>
    <span className="t-pun">:</span>
    <span className="t-pl"> process</span>
    <span className="t-pun">.</span>
    <span className="t-pl">env</span>
    <span className="t-pun">.</span>
    <span className="t-pl">GITHUB_CLIENT_ID</span>
    <span className="t-pun">!, </span>
    <span className="t-cmt">/* ... */</span>
    <span className="t-pl"> </span>
    <span className="t-pun">
      {'}'}
      {')'},
    </span>
    {'\n'}
    <span className="t-pun">{'  '}],</span>
    {'\n'}
    <span className="t-pl">{'  '}callbacks</span>
    <span className="t-pun">: {'{'}</span>
    {'\n'}
    <span className="t-pl">{'    '}</span>
    <span className="t-kw">async </span>
    <span className="t-fn">session</span>
    <span className="t-pun">
      ({'('}
      {'{'}
    </span>
    <span className="t-prm"> session, token </span>
    <span className="t-pun">
      {'}'}
      {')'} {'{'}
    </span>
    {'\n'}
    <span className="t-pl">{'      '}session</span>
    <span className="t-pun">.</span>
    <span className="t-pl">user</span>
    <span className="t-pun">.</span>
    <span className="t-pl">id </span>
    <span className="t-pun">=</span>
    <span className="t-pl"> token</span>
    <span className="t-pun">.</span>
    <span className="t-pl">sub</span>
    <span className="t-pun">;</span>
    {'\n'}
    <span className="t-kw">{'      '}return</span>
    <span className="t-pl"> session</span>
    <span className="t-pun">;</span>
    {'\n'}
    <span className="t-pun">
      {'    '}
      {'}'}
    </span>
    <span className="t-pun">,</span>
    {'\n'}
    <span className="t-pun">
      {'  '}
      {'}'}
    </span>
    <span className="t-pun">,</span>
    {'\n'}
    <span className="t-pun">
      {'}'}
      {')'};
    </span>
  </>
);

const sessionCode = (
  <>
    <span className="t-str">&quot;use client&quot;</span>
    <span className="t-pun">;</span>
    {'\n\n'}
    <span className="t-kw">import</span>
    <span className="t-pun"> {'{'} </span>
    <span className="t-pl">useSession, signIn, signOut</span>
    <span className="t-pun"> {'}'} </span>
    <span className="t-kw">from</span>
    <span className="t-str"> &quot;vinextauth/react&quot;</span>
    <span className="t-pun">;</span>
    {'\n\n'}
    <span className="t-kw">export function</span>
    <span className="t-pl"> </span>
    <span className="t-fn">UserMenu</span>
    <span className="t-pun">() {'{'}</span>
    {'\n'}
    <span className="t-kw">{'  '}const</span>
    <span className="t-pun"> {'{'} </span>
    <span className="t-prm">data</span>
    <span className="t-pun">: </span>
    <span className="t-prm">session</span>
    <span className="t-pun">, </span>
    <span className="t-prm">status</span>
    <span className="t-pun"> {'}'} = </span>
    <span className="t-fn">useSession</span>
    <span className="t-pun">();</span>
    {'\n\n'}
    <span className="t-kw">{'  '}if</span>
    <span className="t-pun"> (status === </span>
    <span className="t-str">&quot;loading&quot;</span>
    <span className="t-pun">)</span>
    <span className="t-kw"> return</span>
    <span className="t-pl"> </span>
    <span className="t-str">&quot;...&quot;</span>
    <span className="t-pun">;</span>
    {'\n'}
    <span className="t-kw">{'  '}if</span>
    <span className="t-pun"> (!session)</span>
    <span className="t-kw"> return</span>
    <span className="t-pun"> (</span>
    {'\n'}
    <span className="t-pun">{'    '}&lt;</span>
    <span className="t-fn">button</span>
    <span className="t-pl"> onClick</span>
    <span className="t-pun">={'{'}</span>
    <span className="t-fn">signIn</span>
    <span className="t-pun">{'}'}&gt;</span>
    <span className="t-str">Sign in</span>
    <span className="t-pun">&lt;/</span>
    <span className="t-fn">button</span>
    <span className="t-pun">&gt;</span>
    {'\n'}
    <span className="t-pun">{'  '});</span>
    {'\n\n'}
    <span className="t-kw">{'  '}return</span>
    <span className="t-pun"> (</span>
    {'\n'}
    <span className="t-pun">{'    '}&lt;</span>
    <span className="t-fn">div</span>
    <span className="t-pun">&gt;</span>
    {'\n'}
    <span className="t-pun">{'      '}&lt;</span>
    <span className="t-fn">p</span>
    <span className="t-pun">&gt;{'{'}</span>
    <span className="t-pl">session</span>
    <span className="t-pun">.</span>
    <span className="t-pl">user</span>
    <span className="t-pun">?.</span>
    <span className="t-pl">name</span>
    <span className="t-pun">{'}'}&lt;/</span>
    <span className="t-fn">p</span>
    <span className="t-pun">&gt;</span>
    {'\n'}
    <span className="t-pun">{'      '}&lt;</span>
    <span className="t-fn">button</span>
    <span className="t-pl"> onClick</span>
    <span className="t-pun">={'{'}</span>
    <span className="t-fn">signOut</span>
    <span className="t-pun">{'}'}&gt;</span>
    <span className="t-str">Sign out</span>
    <span className="t-pun">&lt;/</span>
    <span className="t-fn">button</span>
    <span className="t-pun">&gt;</span>
    {'\n'}
    <span className="t-pun">{'    '}&lt;/</span>
    <span className="t-fn">div</span>
    <span className="t-pun">&gt;</span>
    {'\n'}
    <span className="t-pun">{'  '});</span>
    {'\n'}
    <span className="t-pun">{'}'}</span>
  </>
);

const serverCode = (
  <>
    <span className="t-kw">import</span>
    <span className="t-pun"> {'{'} </span>
    <span className="t-pl">getServerSession</span>
    <span className="t-pun"> {'}'} </span>
    <span className="t-kw">from</span>
    <span className="t-str"> &quot;vinextauth/server&quot;</span>
    <span className="t-pun">;</span>
    {'\n'}
    <span className="t-kw">import</span>
    <span className="t-pun"> {'{'} </span>
    <span className="t-pl">auth</span>
    <span className="t-pun"> {'}'} </span>
    <span className="t-kw">from</span>
    <span className="t-str"> &quot;@/auth&quot;</span>
    <span className="t-pun">;</span>
    {'\n\n'}
    <span className="t-cmt">{'// '}App Router server component</span>
    {'\n'}
    <span className="t-kw">export default async function</span>
    <span className="t-fn"> Dashboard</span>
    <span className="t-pun">() {'{'}</span>
    {'\n'}
    <span className="t-kw">{'  '}const</span>
    <span className="t-pl"> session </span>
    <span className="t-pun">=</span>
    <span className="t-kw"> await </span>
    <span className="t-fn">getServerSession</span>
    <span className="t-pun">(</span>
    <span className="t-pl">auth</span>
    <span className="t-pun">);</span>
    {'\n\n'}
    <span className="t-kw">{'  '}if</span>
    <span className="t-pun"> (!session)</span>
    <span className="t-kw"> return</span>
    <span className="t-pun"> (</span>
    {'\n'}
    <span className="t-pun">{'    '}&lt;</span>
    <span className="t-fn">p</span>
    <span className="t-pun">&gt;</span>
    <span className="t-str">Not authenticated</span>
    <span className="t-pun">&lt;/</span>
    <span className="t-fn">p</span>
    <span className="t-pun">&gt;</span>
    {'\n'}
    <span className="t-pun">{'  '});</span>
    {'\n\n'}
    <span className="t-kw">{'  '}return</span>
    <span className="t-pun"> (</span>
    {'\n'}
    <span className="t-pun">{'    '}&lt;</span>
    <span className="t-fn">h1</span>
    <span className="t-pun">&gt;</span>
    <span className="t-str">Hello, {'{'}</span>
    <span className="t-pl">session</span>
    <span className="t-pun">.</span>
    <span className="t-pl">user</span>
    <span className="t-pun">?.</span>
    <span className="t-pl">name</span>
    <span className="t-str">{'}'}</span>
    <span className="t-pun">&lt;/</span>
    <span className="t-fn">h1</span>
    <span className="t-pun">&gt;</span>
    {'\n'}
    <span className="t-pun">{'  '});</span>
    {'\n'}
    <span className="t-pun">{'}'}</span>
  </>
);

export default function HomePage() {
  const codeTabs = [
    { id: 'config', label: 'auth.ts', content: authTsCode },
    { id: 'client', label: 'client component', content: sessionCode },
    { id: 'server', label: 'server component', content: serverCode },
  ];

  return (
    <div className="lp-root">
      {/* ── Hero ── */}
      <section className="lp-hero">
        <div className="lp-badge">
          <span className="lp-badge-dot" />
          Drop-in replacement for NextAuth v4
        </div>

        <h1 className="lp-title">
          {'Auth built for '}
          <span className="lp-title-gradient">Vinext</span>
        </h1>

        <p className="lp-description">
          VinextAuth runs natively on Cloudflare Workers with zero Node.js dependencies. Same API as
          NextAuth v4 — switch with one import change.
        </p>

        <div className="lp-actions">
          <Link href="/docs" className="lp-btn-primary">
            Get Started
            <svg viewBox="0 0 16 16" fill="currentColor" width={14} height={14}>
              <path
                fillRule="evenodd"
                d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </Link>
          <a
            href="https://github.com/rocketapps-tech/vinextauth"
            target="_blank"
            rel="noopener noreferrer"
            className="lp-btn-secondary"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16}>
              <path
                fillRule="evenodd"
                d="M10 0C4.477 0 0 4.477 0 10c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.578 9.578 0 0 1 10 4.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C17.137 18.163 20 14.418 20 10 20 4.477 15.523 0 10 0Z"
                clipRule="evenodd"
              />
            </svg>
            GitHub
          </a>
        </div>

        <div className="lp-install">
          <span className="lp-install-prompt">$</span>
          npm install vinextauth
          <span className="lp-install-copy">
            <svg viewBox="0 0 16 16" fill="currentColor" width={13} height={13}>
              <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
              <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
            </svg>
          </span>
        </div>
      </section>

      {/* ── Providers ── */}
      <section className="lp-providers">
        <p className="lp-providers-label">Works with 12 providers out of the box</p>
        <div className="lp-providers-grid">
          {providers.map((p) => (
            <span key={p.name} className="lp-provider-pill">
              <span className="lp-provider-dot" style={{ background: p.color }} />
              {p.name}
            </span>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="lp-section">
        <div className="lp-section-inner">
          <span className="lp-section-eyebrow">Built different</span>
          <h2 className="lp-section-title">Everything auth needs. Nothing it doesn&apos;t.</h2>
          <p className="lp-section-sub">
            Designed from the ground up for the Cloudflare Workers runtime — no compromises, no
            polyfills.
          </p>

          <div className="lp-grid">
            {features.map((f) => (
              <div key={f.num} className="lp-card">
                <div className="lp-card-num">{f.num}</div>
                <div className="lp-card-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Code examples ── */}
      <section className="lp-code-section">
        <div className="lp-code-layout">
          {/* Left: text */}
          <div className="lp-code-info">
            <span className="lp-section-eyebrow">Quick start</span>
            <h2 className="lp-section-title">Running in under 5 minutes</h2>
            <p className="lp-section-sub">
              Configure once, use everywhere — server components, client hooks, API routes, and
              middleware all share the same session.
            </p>

            <div className="lp-code-steps">
              <div className="lp-code-step">
                <span className="lp-code-step-num">1</span>
                <span className="lp-code-step-text">
                  <strong>Install</strong> the package and set{' '}
                  <code
                    style={{
                      fontFamily: 'var(--lp-mono)',
                      fontSize: '0.8em',
                      color: 'var(--lp-purple)',
                    }}
                  >
                    NEXTAUTH_SECRET
                  </code>
                </span>
              </div>
              <div className="lp-code-step">
                <span className="lp-code-step-num">2</span>
                <span className="lp-code-step-text">
                  <strong>Configure</strong> your providers in{' '}
                  <code
                    style={{
                      fontFamily: 'var(--lp-mono)',
                      fontSize: '0.8em',
                      color: 'var(--lp-purple)',
                    }}
                  >
                    auth.ts
                  </code>
                </span>
              </div>
              <div className="lp-code-step">
                <span className="lp-code-step-num">3</span>
                <span className="lp-code-step-text">
                  <strong>Use</strong> sessions in server and client components
                </span>
              </div>
              <div className="lp-code-step">
                <span className="lp-code-step-num">4</span>
                <span className="lp-code-step-text">
                  <strong>Deploy</strong> to Cloudflare Workers — zero cold starts
                </span>
              </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <Link
                href="/docs/getting-started"
                className="lp-btn-primary"
                style={{ display: 'inline-flex', fontSize: '0.8125rem' }}
              >
                Full setup guide &rarr;
              </Link>
            </div>
          </div>

          {/* Right: code window */}
          <CodeTabs tabs={codeTabs} />
        </div>
      </section>

      {/* ── Migration banner ── */}
      <section className="lp-migration">
        <div className="lp-migration-inner">
          <div className="lp-migration-tag">
            <svg viewBox="0 0 16 16" fill="currentColor" width={11} height={11}>
              <path
                fillRule="evenodd"
                d="M14.78 3.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 7.28a.75.75 0 0 1 1.06-1.06L7 9.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"
                clipRule="evenodd"
              />
            </svg>
            Migration
          </div>

          <h2 className="lp-migration-title">Already using NextAuth v4?</h2>
          <p className="lp-migration-sub">
            VinextAuth is a true drop-in replacement. Same callbacks, same session shape, same
            cookie format. One import change and you&apos;re on Vinext.
          </p>

          <div className="lp-migration-code">
            <div className="lp-migration-diff">
              <div className="lp-diff-line lp-diff-minus">
                <span className="lp-diff-sign">−</span>
                <span>import NextAuth from &ldquo;next-auth&rdquo;</span>
              </div>
              <div className="lp-diff-line lp-diff-plus">
                <span className="lp-diff-sign">+</span>
                <span>import VinextAuth from &ldquo;vinextauth&rdquo;</span>
              </div>
            </div>
          </div>

          <Link
            href="/docs/getting-started/migration"
            className="lp-btn-secondary"
            style={{ display: 'inline-flex' }}
          >
            Read the migration guide &rarr;
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-brand">
          <Logo height={22} className="lp-footer-logo" />
          <span className="lp-footer-badge">MIT</span>
          <span style={{ color: 'var(--lp-text-muted)' }}>v{pkg.version}</span>
        </div>

        <div className="lp-footer-links">
          <Link href="/docs">Docs</Link>
          <Link href="/docs/getting-started/migration">Migration</Link>
          <a
            href="https://www.npmjs.com/package/vinextauth"
            target="_blank"
            rel="noopener noreferrer"
          >
            npm
          </a>
          <a
            href="https://github.com/rocketapps-tech/vinextauth"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <a href="https://vinext.io" target="_blank" rel="noopener noreferrer">
            Vinext
          </a>
        </div>
      </footer>
    </div>
  );
}
