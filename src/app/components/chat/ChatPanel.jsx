'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useChatComposer } from '../../hooks/useChatComposer';
import ChatMessageList from './ChatMessageList';
import ChatInputArea from './ChatInputArea';

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    '你好，我是 MediaFlow 的网站全能助手，兼具 AI 创作专家与八字命理师双重身份。\n\n你可以问我：\n· 文生图/图生图、视频转换（静止图转视频、参数设置）\n· 生辰八字简析与转运建议\n· 操作步骤与参数（如 ControlNet、Seed、运动强度、重绘幅度）\n· **上传 GIF**：在输入框旁点 📎，可说「转成 WebP，质量 75」，我会调用站内工具转换并提供下载\n· 对话结束后可「导出对话 PDF」',
};

export default function ChatPanel({ variant = 'page', className = '', toolKey = null }) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const listRef = useRef(null);

  const {
    busy,
    toolRunning,
    streamingContent,
    streamingThinking,
    streamingSources,
    streamingToolCalls,
    send,
    attachments,
    addFiles,
    removeAttachment,
  } = useChatComposer({ setMessages, chatContext: { toolKey } });

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, streamingContent, streamingThinking, streamingSources, toolRunning]);

  const handleSend = async () => {
    if (busy) return;
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    setInput('');
    await send(messages, text);
  };

  const isPage = variant === 'page';
  const rootClass = isPage
    ? `flex h-full min-h-0 flex-1 flex-col ${className}`
    : `flex h-full flex-col ${className}`;

  return (
    <div className={rootClass}>
      <div
        ref={listRef}
        className={
          isPage
            ? 'min-h-0 flex-1 overflow-y-auto bg-mf-canvas px-4 py-6 md:px-6'
            : 'min-h-0 flex-1 overflow-y-auto p-4'
        }
      >
        <ChatMessageList
          messages={messages}
          streamingThinking={streamingThinking}
          streamingContent={streamingContent}
          streamingSources={streamingSources}
          streamingToolCalls={streamingToolCalls}
          loading={busy}
          toolRunning={toolRunning}
          variant={isPage ? 'page' : 'float'}
        />
      </div>

      <div
        className={
          isPage
            ? 'shrink-0 border-t border-mf-border bg-mf-surface px-4 py-4 md:px-6'
            : 'shrink-0 border-t border-mf-border bg-mf-surface p-3'
        }
      >
        <ChatInputArea
          className={isPage ? 'mx-auto max-w-3xl' : ''}
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          busy={busy}
          attachments={attachments}
          onAddFiles={addFiles}
          onRemoveAttachment={removeAttachment}
          messages={messages}
          showPdf
          showFooterHint={isPage}
        />
      </div>
    </div>
  );
}
