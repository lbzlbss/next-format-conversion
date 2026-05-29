'use client';

import { Select } from 'antd';
import { listToolsForFile } from '../../lib/chat-tools/registry.js';

/**
 * @param {{
 *   attachment: import('../../hooks/useChatAttachments.js').ChatPendingAttachment | null,
 *   preferredToolId: string | null,
 *   onChange: (id: string | null) => void,
 * }} props
 */
export default function ChatToolPicker({ attachment, preferredToolId, onChange }) {
  if (!attachment) {
    return (
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-mf-muted">
        <span>无附件时可文生图，例如：「生成一张赛博朋克城市夜景」</span>
      </div>
    );
  }

  const options = listToolsForFile(attachment.file).map((t) => ({
    value: t.id,
    label: t.label,
  }));

  if (options.length <= 1) return null;

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <span className="text-[11px] text-mf-muted">处理方式</span>
      <Select
        size="small"
        className="min-w-[160px]"
        value={preferredToolId || options[0]?.value}
        options={options}
        onChange={(v) => onChange(v)}
      />
    </div>
  );
}
