'use client';

import Link from 'next/link';
import { ArrowLeftOutlined } from '@ant-design/icons';

export default function SubPageHeader({ title, subtitle, backHref = '/', backLabel = '返回首页', actions }) {
  return (
    <header className="shrink-0 border-b border-mf-border bg-mf-surface px-4 py-4 md:px-6">
      <div className="mx-auto flex max-w-5xl items-center gap-3 md:gap-4">
        <Link
          href={backHref}
          className="mf-focus-ring flex size-9 shrink-0 items-center justify-center rounded-lg text-mf-muted transition hover:bg-mf-canvas hover:text-mf-text"
          aria-label={backLabel}
        >
          <ArrowLeftOutlined />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-mono text-lg font-semibold text-mf-text md:text-xl">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-xs text-mf-muted md:text-sm">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
