'use client';

import { useRef } from 'react';
import { Button, Input } from 'antd';
import { SendOutlined, PaperClipOutlined } from '@ant-design/icons';
import ChatAttachmentBar from './ChatAttachmentBar.jsx';
import ChatPdfButton from './ChatPdfButton.jsx';

const { TextArea } = Input;

/**
 * @param {{
 *   input: string,
 *   onInputChange: (v: string) => void,
 *   onSend: () => void,
 *   busy: boolean,
 *   attachments: import('../../hooks/useChatAttachments.js').ChatPendingAttachment[],
 *   onAddFiles: (files: FileList | File[]) => { ok: boolean, error?: string },
 *   onRemoveAttachment: (id: string) => void,
 *   messages: Array<Record<string, unknown>>,
 *   showPdf?: boolean,
 *   showFooterHint?: boolean,
 *   className?: string,
 * }} props
 */
export default function ChatInputArea({
  input,
  onInputChange,
  onSend,
  busy,
  attachments,
  onAddFiles,
  onRemoveAttachment,
  messages,
  showPdf = true,
  showFooterHint = false,
  className = '',
}) {
  const fileRef = useRef(null);

  const handlePickFile = () => {
    fileRef.current?.click();
  };

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    const result = onAddFiles(files);
    if (!result.ok && result.error) {
      window.alert(result.error);
    }
    e.target.value = '';
  };

  return (
    <div className={className}>
      {showPdf ? (
        <div className="mb-2 flex justify-end">
          <ChatPdfButton mode="full" messages={messages} size="small" />
        </div>
      ) : null}

      <ChatAttachmentBar attachments={attachments} onRemove={onRemoveAttachment} />

      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/gif,.gif"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="default"
          icon={<PaperClipOutlined />}
          onClick={handlePickFile}
          disabled={busy}
          className="shrink-0 self-end rounded-xl"
          aria-label="上传 GIF"
        />
        <TextArea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="输入问题；可上传 GIF 一键转 WebP"
          autoSize={{ minRows: 1, maxRows: 5 }}
          className="min-w-0 flex-1 rounded-xl"
          disabled={busy}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={onSend}
          loading={busy}
          className="h-auto shrink-0 self-end rounded-xl !bg-mf-cta !border-mf-cta px-5"
        >
          发送
        </Button>
      </div>

      {showFooterHint ? (
        <div className="mt-2 text-center text-[11px] text-mf-muted">
          模型：豆包 Seed 2.0 Lite · 支持 GIF→WebP 工具调用
        </div>
      ) : null}
    </div>
  );
}
