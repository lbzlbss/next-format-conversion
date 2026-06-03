'use client';

import { useRef } from 'react';
import { Button, Input } from 'antd';
import { SendOutlined, PaperClipOutlined, PauseOutlined } from '@ant-design/icons';
import ChatAttachmentBar from './ChatAttachmentBar.jsx';
import ChatPdfButton from './ChatPdfButton.jsx';
import ChatToolPicker from './ChatToolPicker.jsx';
import { CHAT_ACCEPT } from '../../lib/chat-tools/constants.js';

const { TextArea } = Input;

/**
 * @param {{
 *   input: string,
 *   onInputChange: (v: string) => void,
 *   onSend: () => void,
 *   onStop?: () => void,
 *   canStop?: boolean,
 *   busy: boolean,
 *   attachments: import('../../hooks/useChatAttachments.js').ChatPendingAttachment[],
 *   onAddFiles: (files: FileList | File[]) => { ok: boolean, error?: string },
 *   onRemoveAttachment: (id: string) => void,
 *   preferredToolId: string | null,
 *   onPreferredToolChange: (id: string | null) => void,
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
  onStop,
  canStop = false,
  busy,
  attachments,
  onAddFiles,
  onRemoveAttachment,
  preferredToolId,
  onPreferredToolChange,
  messages,
  showPdf = true,
  showFooterHint = false,
  className = '',
}) {
  const fileRef = useRef(null);
  const att = attachments[0] ?? null;

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
    onPreferredToolChange(null);
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

      <ChatToolPicker
        attachment={att}
        preferredToolId={preferredToolId}
        onChange={onPreferredToolChange}
      />

      <div className="flex gap-2">
        <input
          ref={fileRef}
          type="file"
          accept={CHAT_ACCEPT}
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          type="default"
          icon={<PaperClipOutlined />}
          onClick={handlePickFile}
          disabled={busy}
          className="shrink-0 self-end rounded-xl"
          aria-label="上传附件"
        />
        <TextArea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey && !busy) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="提问、文生图，或上传 GIF/MP4/图片 调用站内工具"
          autoSize={{ minRows: 1, maxRows: 5 }}
          className="min-w-0 flex-1 rounded-xl"
          disabled={busy && !canStop}
        />
        {canStop ? (
          <Button
            type="default"
            danger
            icon={<PauseOutlined />}
            onClick={onStop}
            className="h-auto shrink-0 self-end rounded-xl px-5"
          >
            暂停
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={onSend}
            loading={busy}
            disabled={busy}
            className="h-auto shrink-0 self-end rounded-xl !bg-mf-cta !border-mf-cta px-5"
          >
            发送
          </Button>
        )}
      </div>

      {showFooterHint ? (
        <div className="mt-2 text-center text-[11px] text-mf-muted">
          支持：GIF↔WebP/MP4/压缩 · MP4压缩/首帧 · 图片压缩 · 文生图 · VAP/SVGA 请用首页工具
        </div>
      ) : null}
    </div>
  );
}
