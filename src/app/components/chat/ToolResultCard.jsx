'use client';

import { Button, Tag } from 'antd';
import { DownloadOutlined, LoadingOutlined, LinkOutlined } from '@ant-design/icons';
import { CHAT_TOOLS } from '../../lib/chat-tools/registry.js';

function formatBytes(n) {
  if (!n) return '—';
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

/**
 * @param {{ toolCall: import('../../hooks/useChatStream.js').ToolCall }} props
 */
export default function ToolResultCard({ toolCall }) {
  if (!toolCall) return null;

  const tool = CHAT_TOOLS[toolCall.toolId];
  const label = tool?.label || toolCall.toolId || '工具';

  if (toolCall.status === 'running') {
    return (
      <div className="mt-2 rounded-xl border border-dashed border-mf-border bg-mf-canvas px-3 py-3 text-xs text-mf-muted">
        <LoadingOutlined className="mr-1" />
        正在执行 {label}…
      </div>
    );
  }

  if (toolCall.status === 'error') {
    return (
      <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-xs text-red-700">
        <div className="font-semibold">{label} 失败</div>
        <div className="mt-1">{toolCall.error || '未知错误'}</div>
      </div>
    );
  }

  const out = toolCall.output;
  if (!out) return null;

  if (out.imageUrl) {
    return (
      <div className="mt-2 rounded-xl border border-mf-border bg-mf-canvas px-3 py-3 text-xs text-mf-text">
        <div className="mb-2 font-semibold">{label} 已完成</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={out.imageUrl}
          alt="生成结果"
          className="mb-2 max-h-48 w-full rounded-lg object-contain bg-black/5"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="primary"
            size="small"
            icon={<LinkOutlined />}
            className="!bg-mf-cta !border-mf-cta"
            href={out.imageUrl}
            target="_blank"
            rel="noreferrer"
          >
            打开图片
          </Button>
        </div>
      </div>
    );
  }

  const saved =
    out.beforeBytes > 0
      ? Math.round((1 - out.afterBytes / out.beforeBytes) * 100)
      : 0;

  return (
    <div className="mt-2 rounded-xl border border-mf-border bg-mf-canvas px-3 py-3 text-xs text-mf-text">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-semibold">{label} 已完成</span>
        {saved > 0 ? <Tag color="green">约减小 {saved}%</Tag> : null}
      </div>
      {out.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={out.previewUrl}
          alt={out.fileName}
          className="mb-2 max-h-32 w-full rounded-lg object-contain bg-black/5"
        />
      ) : null}
      <div className="text-mf-muted">
        {formatBytes(out.beforeBytes)} → {formatBytes(out.afterBytes)}
      </div>
      {out.downloadUrl ? (
        <div className="mt-2">
          <Button
            type="primary"
            size="small"
            icon={<DownloadOutlined />}
            className="!bg-mf-cta !border-mf-cta"
            onClick={() => {
              const a = document.createElement('a');
              a.href = out.downloadUrl;
              a.download = out.fileName || 'download';
              document.body.appendChild(a);
              a.click();
              a.remove();
            }}
          >
            下载 {out.fileName}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
