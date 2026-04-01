'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function LangSwitch() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isPt = pathname.startsWith('/pt');

  function href(code: 'en' | 'pt') {
    if (code === 'en') {
      return pathname.replace(/^\/pt/, '') || '/';
    }
    if (isPt) return pathname;
    if (pathname === '/') return '/pt';
    return `/pt${pathname}`;
  }

  return (
    <div className="lp-lang-switch">
      <Link href={href('en')} className="lp-lang-btn" data-active={mounted ? (!isPt).toString() : 'false'}>
        EN
      </Link>
      <Link href={href('pt')} className="lp-lang-btn" data-active={mounted ? isPt.toString() : 'false'}>
        PT
      </Link>
    </div>
  );
}
