'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export function LangSwitch() {
  const pathname = usePathname();
  const isPt = pathname.startsWith('/pt');

  function href(code: 'en' | 'pt') {
    if (code === 'en') {
      const stripped = pathname.replace(/^\/pt/, '') || '/';
      return stripped;
    }
    if (pathname === '/') return '/pt';
    return `/pt${pathname}`;
  }

  return (
    <div className="lp-lang-switch">
      <Link
        href={href('en')}
        className="lp-lang-btn"
        data-active={(!isPt).toString()}
      >
        EN
      </Link>
      <Link
        href={href('pt')}
        className="lp-lang-btn"
        data-active={isPt.toString()}
      >
        PT
      </Link>
    </div>
  );
}
