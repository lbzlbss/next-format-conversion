'use client';

import { useState } from 'react';
import { Button, message } from 'antd';
import { FilePdfOutlined } from '@ant-design/icons';
import { downloadChatPdf, messagesForPdfExport } from '../../lib/chat-pdf-client';

/**
 * @param {Object} props
 * @param {'full'|'single'} props.mode
 * @param {Array} props.messages - 完整对话列表
 * @param {Object} [props.singleMessage] - mode=single 时导出的一条
 * @param {'link'|'default'|'text'} [props.type]
 * @param {'small'|undefined} [props.size]
 */
export default function ChatPdfButton({
  mode = 'full',
  messages,
  singleMessage,
  type = 'default',
  size = 'small',
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    const exportMessages =
      mode === 'single' && singleMessage
        ? messagesForPdfExport([singleMessage])
        : messagesForPdfExport(messages);

    if (exportMessages.length === 0) {
      message.warning('没有可导出的对话内容');
      return;
    }

    setLoading(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadChatPdf({
        title:
          mode === 'single'
            ? 'MediaFlow AI 回复摘要'
            : 'MediaFlow AI 对话记录',
        filename:
          mode === 'single'
            ? `mediaflow-reply-${stamp}`
            : `mediaflow-chat-${stamp}`,
        messages: exportMessages,
        includeThinking: true,
      });
      message.success('PDF 已开始下载');
    } catch (err) {
      message.error(err?.message || 'PDF 生成失败');
    } finally {
      setLoading(false);
    }
  };

  const label = mode === 'single' ? '导出 PDF' : '导出对话 PDF';

  if (type === 'link') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="mf-focus-ring inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-mf-muted transition hover:bg-mf-canvas hover:text-mf-cta disabled:opacity-50"
        aria-label={label}
      >
        <FilePdfOutlined />
        {loading ? '生成中…' : 'PDF'}
      </button>
    );
  }

  return (
    <Button
      type={type === 'text' ? 'text' : 'default'}
      size={size}
      icon={<FilePdfOutlined />}
      loading={loading}
      onClick={handleClick}
      className="rounded-lg"
    >
      {label}
    </Button>
  );
}
