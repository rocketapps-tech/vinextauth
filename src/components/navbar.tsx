'use client';

import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Logo } from './logo';
import { LangSwitch } from './lang-switch';

interface NavbarProps {
  docsHref: string;
  homeHref: string;
}

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16} aria-hidden>
      <path d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2ZM10 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15ZM10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM15.657 5.404a.75.75 0 1 0-1.06-1.06l-1.061 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM6.464 14.596a.75.75 0 1 0-1.06-1.06l-1.06 1.06a.75.75 0 0 0 1.06 1.06l1.06-1.06ZM18 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 18 10ZM5 10a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5A.75.75 0 0 1 5 10ZM14.596 15.657a.75.75 0 0 0 1.06-1.06l-1.06-1.061a.75.75 0 1 0-1.06 1.06l1.06 1.06ZM5.404 6.464a.75.75 0 0 0 1.06-1.06L5.404 4.343a.75.75 0 1 0-1.06 1.06l1.06 1.061Z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width={16} height={16} aria-hidden>
      <path
        fillRule="evenodd"
        d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" width={15} height={15} aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 0C4.477 0 0 4.477 0 10c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.268 2.75 1.026A9.578 9.578 0 0 1 10 4.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.026 2.747-1.026.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C17.137 18.163 20 14.418 20 10 20 4.477 15.523 0 10 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function Navbar({ docsHref, homeHref }: NavbarProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="lp-nav">
      <div className="lp-nav-inner">
        {/* Logo */}
        <Link href={homeHref} className="lp-nav-logo-link" aria-label="VinextAuth home">
          <Logo height={24} />
        </Link>

        {/* Right side */}
        <div className="lp-nav-right">
          <Link href={docsHref} className="lp-nav-link">
            Docs
          </Link>

          <div className="lp-nav-divider" aria-hidden />

          <LangSwitch />

          {/* Theme toggle */}
          <button
            className="lp-nav-icon-btn"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
            type="button"
          >
            {mounted && resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>

          {/* GitHub */}
          <a
            href="https://github.com/rocketapps-tech/vinextauth"
            target="_blank"
            rel="noopener noreferrer"
            className="lp-nav-github"
          >
            <GitHubIcon />
            <span className="lp-nav-github-label">GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
}
