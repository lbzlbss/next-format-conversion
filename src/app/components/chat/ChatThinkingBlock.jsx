'use client';

import { useEffect, useId, useState } from 'react';
import { BulbOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';

/**
 * @param {{
 *   title: string,
 *   content: string,
 *   defaultExpanded?: boolean,
 *   streaming?: boolean,
 *   variant?: 'page' | 'float',
 * }} props
 */
export default function ChatThinkingBlock({
  title,
  content,
  defaultExpanded = false,
  streaming = false,
  variant = 'page',
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const panelId = useId();
  const isPage = variant === 'page';

  useEffect(() => {
    if (streaming) setExpanded(true);
  }, [streaming]);

  if (!content?.trim()) return null;

  return (
    <div
      className={`mb-2 rounded-xl border text-xs ${
        isPage
          ? 'border-mf-border bg-mf-accent-soft text-mf-accent-soft-fg'
          : 'border-[#e2e8f0] bg-[#f8fafc] text-[#475569]'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`mf-focus-ring flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left font-semibold ${
          isPage ? 'text-mf-accent-soft-fg' : 'text-[#334155]'
        }`}
        aria-expanded={expanded}
        aria-controls={panelId}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <BulbOutlined className="shrink-0" />
          <span className="truncate">{title}</span>
          {streaming ? (
            <span className="shrink-0 font-normal opacity-70">流式更新中</span>
          ) : null}
        </span>
        {expanded ? (
          <UpOutlined className="shrink-0 text-[10px] opacity-70" />
        ) : (
          <DownOutlined className="shrink-0 text-[10px] opacity-70" />
        )}
      </button>
      <div
        id={panelId}
        className={`overflow-hidden px-4 transition-[max-height,opacity,padding] duration-200 ${
          expanded ? 'max-h-[min(40vh,320px)] overflow-y-auto pb-3 opacity-100' : 'max-h-0 pb-0 opacity-0'
        }`}
      >
        <div className="whitespace-pre-wrap break-words opacity-90">{content}</div>
      </div>
      {!expanded && content.length > 72 ? (
        <div className="border-t border-mf-border/40 px-4 py-1.5 text-[10px] opacity-60">
          点击展开完整思考过程
        </div>
      ) : null}
    </div>
  );
}
