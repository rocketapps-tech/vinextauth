'use client';

import { useId } from 'react';

interface LogoProps {
  height?: number;
  className?: string;
}

export function Logo({ height = 28, className }: LogoProps) {
  const uid = useId().replace(/:/g, '');
  const g1 = `${uid}a`;
  const g2 = `${uid}b`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 168 32"
      fill="none"
      height={height}
      style={{ width: 'auto', display: 'block' }}
      className={className}
      aria-label="VinextAuth"
    >
      {/* Shield */}
      <path
        d="M14 1.5 L3.5 6 V15.5 C3.5 21.5 8 26 14 27.8 C20 26 24.5 21.5 24.5 15.5 V6 Z"
        fill={`url(#${g1})`}
      />
      {/* Inner highlight */}
      <path
        d="M14 3.8 L5.5 7.8 V15.5 C5.5 20.5 9.2 24.3 14 25.8 C18.8 24.3 22.5 20.5 22.5 15.5 V7.8 Z"
        fill={`url(#${g2})`}
        opacity="0.22"
      />
      {/* Lightning bolt */}
      <path
        d="M16.8 9.5 L12 15.8 H15 L12 20 L19.5 13.5 H16.5 Z"
        fill="white"
        opacity="0.95"
      />
      {/* Wordmark */}
      <text
        fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Helvetica, Arial, sans-serif"
        fontSize="16"
        y="20.5"
      >
        <tspan x="33" fontWeight="700" fill="currentColor" letterSpacing="-0.3">
          Vinext
        </tspan>
        <tspan fontWeight="500" fill="var(--lp-purple)" letterSpacing="-0.2">
          Auth
        </tspan>
      </text>
      <defs>
        <linearGradient id={g1} x1="3.5" y1="1.5" x2="24.5" y2="27.8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#6d28d9" />
          <stop offset="55%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
        <linearGradient id={g2} x1="5.5" y1="3.8" x2="22.5" y2="25.8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
    </svg>
  );
}
