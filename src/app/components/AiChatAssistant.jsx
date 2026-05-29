'use client';

import React, { useState, useRef, useEffect } from 'react';
import { RobotOutlined, CloseOutlined } from '@ant-design/icons';
import { useChatComposer } from '../hooks/useChatComposer';
import ChatMessageList from './chat/ChatMessageList';
import ChatInputArea from './chat/ChatInputArea';

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    '你好，我是 MediaFlow 的网站全能助手，兼具 AI 创作专家与八字命理师双重身份。\n\n你可以问我：\n· 文生图/图生图、视频转换\n· 生辰八字简析与转运建议\n· **上传 GIF**（输入框旁 📎）一键转 WebP 并下载\n· 支持导出对话或单条回复为 PDF',
};

const AiChatAssistant = () => {
  const [open, setOpen] = useState(false);
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
  } = useChatComposer({ setMessages });

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, streamingContent, streamingThinking, toolRunning]);

  const handleSend = async () => {
    if (busy) return;
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    setInput('');
    await send(messages, text);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[1000] flex size-14 items-center justify-center rounded-full bg-mf-cta text-white shadow-lg transition hover:scale-105 hover:shadow-xl"
        aria-label="打开 AI 助手"
      >
        <RobotOutlined className="text-[24px]" />
      </button>

      {open && (
        <div
          className="fixed bottom-24 right-6 z-[1000] flex h-[520px] w-[400px] flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-xl"
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-mf-cta">
                <RobotOutlined className="text-white" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-bold text-[#0f172a]">AI 对话助手</div>
                <div className="text-[11px] text-[#94a3b8]">创作 · 转换 · GIF→WebP</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex size-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]"
              aria-label="关闭"
            >
              <CloseOutlined />
            </button>
          </div>

          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-4">
            <ChatMessageList
              messages={messages}
              streamingThinking={streamingThinking}
              streamingContent={streamingContent}
              streamingSources={streamingSources}
              streamingToolCalls={streamingToolCalls}
              loading={busy}
              toolRunning={toolRunning}
              variant="float"
            />
          </div>

          <div className="shrink-0 border-t border-[#e2e8f0] p-3">
            <ChatInputArea
              input={input}
              onInputChange={setInput}
              onSend={handleSend}
              busy={busy}
              attachments={attachments}
              onAddFiles={addFiles}
              onRemoveAttachment={removeAttachment}
              messages={messages}
              showPdf
            />
          </div>
        </div>
      )}
    </>
  );
};

export default AiChatAssistant;
