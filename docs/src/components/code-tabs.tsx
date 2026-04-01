'use client';

import { useState } from 'react';

type Tab = { id: string; label: string; content: React.ReactNode };

interface CodeTabsProps {
  tabs: Tab[];
  filename?: string;
}

export function CodeTabs({ tabs, filename }: CodeTabsProps) {
  const [active, setActive] = useState(tabs[0].id);
  const current = tabs.find((t) => t.id === active)!;

  return (
    <div className="lp-code-window">
      <div className="lp-code-titlebar">
        <div className="lp-code-dots">
          <span className="lp-code-dot lp-code-dot-red" />
          <span className="lp-code-dot lp-code-dot-yellow" />
          <span className="lp-code-dot lp-code-dot-green" />
        </div>
        {filename && <span className="lp-code-filename">{filename}</span>}
      </div>

      <div className="lp-code-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className="lp-code-tab"
            data-active={active === t.id ? 'true' : 'false'}
            onClick={() => setActive(t.id)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="lp-code-body">
        <pre>{current.content}</pre>
      </div>
    </div>
  );
}
