'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Input } from 'antd';
import { SearchOutlined, RightOutlined } from '@ant-design/icons';
import { CATEGORY_DESC, CATEGORY_LABEL } from './markdown-utils';

/**
 * @param {{
 *   categories: Array<{ id: string, label: string }>,
 *   articles: Array<{
 *     slug: string,
 *     title: string,
 *     description?: string,
 *     category: string,
 *     tags?: string[],
 *     toolKey?: string | null,
 *     updatedAt?: string,
 *   }>,
 * }} props
 */
export default function WikiIndexClient({ categories, articles }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) => {
      const hay = [a.title, a.description, a.category, ...(a.tags || [])].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [articles, query]);

  const byCategory = useMemo(() => {
    const map = {};
    for (const a of filtered) {
      const cat = a.category || 'tools';
      if (!map[cat]) map[cat] = [];
      map[cat].push(a);
    }
    return map;
  }, [filtered]);

  const categoryOrder = useMemo(() => {
    const fromIndex = categories.map((c) => c.id);
    const ordered =
      fromIndex.length > 0
        ? fromIndex.filter((id) => byCategory[id]?.length)
        : Object.keys(byCategory);
    return ordered;
  }, [categories, byCategory]);

  return (
    <>
      <div className="mb-6">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
          prefix={<SearchOutlined className="text-mf-muted" />}
          placeholder="搜索标题、标签或说明…"
          className="h-11 max-w-lg rounded-xl"
          size="large"
        />
        <p className="mt-2 text-xs text-mf-muted">
          共 {articles.length} 篇文档
          {query.trim() ? ` · 匹配 ${filtered.length} 篇` : null}
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-mf-muted">没有匹配的文章，试试其他关键词。</p>
      ) : (
        categoryOrder.map((catId) => (
          <section key={catId} className="mb-10">
            <div className="mb-4">
              <h2 className="font-mono text-sm font-bold text-mf-text">
                {CATEGORY_LABEL[catId] || catId}
              </h2>
              {CATEGORY_DESC[catId] ? (
                <p className="mt-0.5 text-xs text-mf-muted">{CATEGORY_DESC[catId]}</p>
              ) : null}
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {byCategory[catId].map((a) => (
                <li key={a.slug}>
                  <Link href={`/wiki/${a.slug}`} className="mf-card mf-card-hover group flex h-full flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-mf-text group-hover:text-mf-cta">{a.title}</h3>
                      <RightOutlined className="mt-1 shrink-0 text-xs text-mf-muted transition group-hover:text-mf-cta" />
                    </div>
                    {a.description ? (
                      <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-mf-muted">
                        {a.description}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {a.toolKey ? (
                        <span className="rounded-md bg-mf-accent-soft px-2 py-0.5 text-[10px] font-medium text-mf-accent-soft-fg">
                          关联工具
                        </span>
                      ) : null}
                      {a.updatedAt ? (
                        <span className="text-[10px] text-mf-muted">{a.updatedAt}</span>
                      ) : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
