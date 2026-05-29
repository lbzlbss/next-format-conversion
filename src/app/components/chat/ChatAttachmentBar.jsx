'use client';

import { PaperClipOutlined, CloseOutlined } from '@ant-design/icons';

function formatBytes(n) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

/**
 * @param {{
 *   attachments: import('../../hooks/useChatAttachments.js').ChatPendingAttachment[],
 *   onRemove: (id: string) => void,
 * }} props
 */
export default function ChatAttachmentBar({ attachments, onRemove }) {
  if (!attachments?.length) return null;

  return (
    <div className="mb-2 flex flex-wrap gap-2">
      {attachments.map((att) => (
        <div
          key={att.id}
          className="flex items-center gap-2 rounded-lg border border-mf-border bg-mf-canvas px-2 py-1 text-xs text-mf-text"
        >
          {att.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={att.previewUrl}
              alt={att.name}
              className="size-8 rounded object-cover"
            />
          ) : (
            <PaperClipOutlined className="text-mf-muted" />
          )}
          <span className="max-w-[140px] truncate">{att.name}</span>
          <span className="text-mf-muted">{formatBytes(att.size)}</span>
          <button
            type="button"
            className="text-mf-muted hover:text-mf-text"
            onClick={() => onRemove(att.id)}
            aria-label="移除附件"
          >
            <CloseOutlined />
          </button>
        </div>
      ))}
    </div>
  );
}
