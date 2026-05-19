'use client';

import Link from 'next/link';
import { Tag } from 'antd';
import { HomeOutlined, MessageOutlined, UnorderedListOutlined } from '@ant-design/icons';
import MarkdownBody from './MarkdownBody';
import { CATEGORY_LABEL } from './markdown-utils';

/**
 * @param {{
 *   article: {
 *     slug: string,
 *     title: string,
 *     description?: string,
 *     category: string,
 *     tags?: string[],
 *     toolKey?: string | null,
 *     updatedAt?: string,
 *     markdown: string,
 *   },
 *   headings: Array<{ id: string, text: string, level: number }>,
 *   related: Array<{ slug: string, title: string }>,
 * }} props
 */
export default function WikiArticleView({ article, headings, related }) {
  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-6 md:grid-cols-[minmax(0,1fr)_200px] md:px-6 md:py-8">
      <div className="min-w-0">
        {headings.length > 0 ? (
          <nav className="mf-card mb-4 p-3 md:hidden" aria-label="目录">
            <div className="mb-2 text-xs font-bold text-mf-muted">目录</div>
            <div className="flex flex-wrap gap-2">
              {headings.map((h) => (
                <a
                  key={h.id}
                  href={`#${h.id}`}
                  className="rounded-full bg-mf-canvas px-2.5 py-1 text-xs text-mf-text transition hover:bg-mf-accent-soft hover:text-mf-cta"
                >
                  {h.text}
                </a>
              ))}
            </div>
          </nav>
        ) : null}

        {article.description ? (
          <p className="mb-4 text-sm leading-relaxed text-mf-muted md:text-base">{article.description}</p>
        ) : null}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Tag color="blue">{CATEGORY_LABEL[article.category] || article.category}</Tag>
          {article.tags?.slice(0, 4).map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
          {article.updatedAt ? (
            <span className="text-xs text-mf-muted">更新于 {article.updatedAt}</span>
          ) : null}
        </div>

        <div className="mf-card p-5 md:p-8">
          <MarkdownBody markdown={article.markdown} skipFirstH1 />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="mf-focus-ring inline-flex items-center gap-1.5 rounded-lg border border-mf-border bg-mf-surface px-3 py-2 text-sm text-mf-text transition hover:border-mf-cta hover:text-mf-cta"
          >
            <HomeOutlined />
            返回工具台
          </Link>
          <Link
            href={`/chat?wiki=${article.slug}`}
            className="mf-focus-ring inline-flex items-center gap-1.5 rounded-lg bg-mf-cta px-3 py-2 text-sm font-medium text-white transition hover:bg-mf-cta-hover"
          >
            <MessageOutlined />
            就此提问
          </Link>
        </div>
      </div>

      <aside className="hidden md:block">
        <div className="sticky top-24 space-y-6">
          {headings.length > 0 ? (
            <nav className="mf-card p-4" aria-label="目录">
              <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-mf-muted">
                <UnorderedListOutlined />
                目录
              </div>
              <ul className="space-y-1.5 text-sm">
                {headings.map((h) => (
                  <li key={h.id}>
                    <a
                      href={`#${h.id}`}
                      className={[
                        'mf-focus-ring block rounded-md py-1 text-mf-muted transition hover:bg-mf-canvas hover:text-mf-cta',
                        h.level === 3 ? 'pl-3' : '',
                      ].join(' ')}
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          {related.length > 0 ? (
            <nav className="mf-card p-4" aria-label="相关文档">
              <div className="mb-3 text-xs font-bold uppercase tracking-wide text-mf-muted">相关阅读</div>
              <ul className="space-y-2 text-sm">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      href={`/wiki/${r.slug}`}
                      className="text-mf-text transition hover:text-mf-cta"
                    >
                      {r.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
