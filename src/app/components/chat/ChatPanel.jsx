'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useChatComposer } from '../../hooks/useChatComposer';
import { useDigitalHumanState } from '../../hooks/useDigitalHumanState';
import {
  DigitalHumanStatusBar,
  DigitalHumanViewport,
} from '../digital-human/DigitalHumanStage';
import ChatMessageList from './ChatMessageList';
import ChatInputArea from './ChatInputArea';

const AVATAR_COLUMN =
  'hidden h-full min-h-0 w-[min(36vw,340px)] shrink-0 flex-col border-r border-mf-border bg-mf-canvas lg:flex';

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    '你好，我是 MediaFlow 的网站全能助手，兼具 AI 创作专家与八字命理师双重身份。\n\n**站内工具（上传附件 📎）**\n· GIF → WebP / 压缩 / 转 MP4\n· MP4 → 压缩 / 提取首帧\n· 图片 JPEG/PNG/WebP → 压缩\n\n**文生图**：直接描述画面，如「生成一张水墨山水」\n\n亦可咨询八字、AI 视频参数；支持导出对话 PDF。\n\nVAP/SVGA/ZIP 批量转换请使用首页专用工具。',
};

export default function ChatPanel({ variant = 'page', className = '', toolKey = null }) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [avatarReady, setAvatarReady] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    setAvatarReady(true);
  }, []);

  const {
    busy,
    toolRunning,
    streamingContent,
    streamingThinking,
    streamingSources,
    streamingToolCalls,
    streamingSurfaces,
    runningSurfaces,
    send,
    stopStreaming,
    loading: streamLoading,
    attachments,
    addFiles,
    removeAttachment,
    preferredToolId,
    setPreferredToolId,
  } = useChatComposer({ setMessages, chatContext: { toolKey } });

  const avatarState = useDigitalHumanState({
    busy,
    toolRunning,
    streamingContent,
    streamingThinking,
  });

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

  if (isPage) {
    return (
      <div className={`flex h-full min-h-0 w-full overflow-hidden ${className}`}>
        {avatarReady ? (
          <aside className={AVATAR_COLUMN}>
            <DigitalHumanViewport state={avatarState} className="h-full min-h-0 flex-1" />
            <DigitalHumanStatusBar state={avatarState} className="shrink-0" />
          </aside>
        ) : (
          <aside className={AVATAR_COLUMN} aria-hidden>
            <div className="flex flex-1 items-center justify-center px-2 pt-6 text-[11px] text-mf-muted">
              加载数字人…
            </div>
            <div className="shrink-0 border-t border-mf-border bg-mf-surface py-4" />
          </aside>
        )}

        <section className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div
            ref={listRef}
            className="min-h-0 flex-1 overflow-y-auto bg-mf-canvas px-4 pt-6 md:px-6"
          >
            <ChatMessageList
              messages={messages}
              streamingThinking={streamingThinking}
              streamingContent={streamingContent}
              streamingSources={streamingSources}
              streamingToolCalls={streamingToolCalls}
              streamingSurfaces={streamingSurfaces}
              runningSurfaces={runningSurfaces}
              loading={busy}
              toolRunning={toolRunning}
              variant="page"
            />
          </div>

          <div className="shrink-0 border-t border-mf-border bg-mf-surface px-4 py-4 md:px-6">
            <ChatInputArea
              className="mx-auto max-w-3xl"
              input={input}
              onInputChange={setInput}
              onSend={handleSend}
              onStop={stopStreaming}
              canStop={streamLoading}
              busy={busy}
              attachments={attachments}
              onAddFiles={addFiles}
              onRemoveAttachment={removeAttachment}
              preferredToolId={preferredToolId}
              onPreferredToolChange={setPreferredToolId}
              messages={messages}
              showPdf
              showFooterHint
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`flex h-full min-h-0 flex-col overflow-hidden ${className}`}>
      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        <ChatMessageList
          messages={messages}
          streamingThinking={streamingThinking}
          streamingContent={streamingContent}
          streamingSources={streamingSources}
          streamingToolCalls={streamingToolCalls}
          streamingSurfaces={streamingSurfaces}
          runningSurfaces={runningSurfaces}
          loading={busy}
          toolRunning={toolRunning}
          variant="float"
        />
      </div>
      <div className="shrink-0 border-t border-mf-border bg-mf-surface p-3">
        <ChatInputArea
          input={input}
          onInputChange={setInput}
          onSend={handleSend}
          onStop={stopStreaming}
          canStop={streamLoading}
          busy={busy}
          attachments={attachments}
          onAddFiles={addFiles}
          onRemoveAttachment={removeAttachment}
          preferredToolId={preferredToolId}
          onPreferredToolChange={setPreferredToolId}
          messages={messages}
          showPdf
        />
      </div>
    </div>
  );
}
