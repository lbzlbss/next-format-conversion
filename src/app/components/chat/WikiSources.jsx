'use client';

import Link from 'next/link';
import { BookOutlined } from '@ant-design/icons';

/**
 * @param {{ sources: Array<{ slug: string, title: string }> }} props
 */
export default function WikiSources({ sources }) {
  if (!sources?.length) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-mf-border pt-2">
      <span className="flex items-center gap-1 text-[11px] text-mf-muted">
        <BookOutlined />
        参考：
      </span>
      {sources.map((s) => (
        <Link
          key={s.slug}
          href={`/wiki/${s.slug}`}
          className="rounded-md bg-mf-accent-soft px-2 py-0.5 text-[11px] font-medium text-mf-accent-soft-fg hover:opacity-90"
        >
          {s.title}
        </Link>
      ))}
    </div>
  );
}
