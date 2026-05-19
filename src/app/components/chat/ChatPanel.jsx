'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Button, Input, Avatar } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, BulbOutlined } from '@ant-design/icons';
import { useChatStream } from '../../hooks/useChatStream';
import WikiSources from './WikiSources';

const { TextArea } = Input;

const WELCOME_MESSAGE = {
  id: 'welcome',
  role: 'assistant',
  content:
    '你好，我是 MediaFlow 的网站全能助手，兼具 AI 创作专家与八字命理师双重身份。\n\n你可以问我：\n· 文生图/图生图、视频转换（静止图转视频、参数设置）\n· 生辰八字简析与转运建议\n· 操作步骤与参数（如 ControlNet、Seed、运动强度、重绘幅度）',
};

export default function ChatPanel({ variant = 'page', className = '', toolKey = null }) {
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const listRef = useRef(null);

  const { loading, streamingContent, streamingThinking, streamingSources, sendMessage } =
    useChatStream({ setMessages, chatContext: { toolKey } });

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, streamingContent, streamingThinking, streamingSources]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    await sendMessage(messages, text);
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
        <div className="mx-auto max-w-3xl space-y-5">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <Avatar
                size={40}
                icon={m.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                className={
                  m.role === 'user'
                    ? 'shrink-0 !bg-mf-cta'
                    : 'shrink-0 !bg-mf-sidebar'
                }
              />
              <div className="min-w-0 max-w-[min(85%,720px)]">
                {m.thinking && (
                  <div className="mb-2 rounded-xl border border-mf-border bg-mf-accent-soft px-4 py-3 text-xs text-mf-accent-soft-fg">
                    <div className="mb-1 flex items-center gap-1 font-semibold">
                      <BulbOutlined />
                      思考过程
                    </div>
                    <div className="whitespace-pre-wrap break-words opacity-90">
                      {m.thinking}
                    </div>
                  </div>
                )}
                <div
                  className={
                    m.role === 'user'
                      ? 'rounded-2xl rounded-tr-md bg-mf-cta px-4 py-3 text-sm text-white'
                      : 'rounded-2xl rounded-tl-md bg-mf-surface px-4 py-3 text-sm text-mf-text shadow-sm ring-1 ring-mf-border'
                  }
                >
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  {m.role === 'assistant' && m.sources?.length > 0 && (
                    <WikiSources sources={m.sources} />
                  )}
                </div>
              </div>
            </div>
          ))}

          {(loading ||
            Boolean(streamingThinking) ||
            Boolean(streamingContent) ||
            (streamingSources?.length ?? 0) > 0) && (
            <div className="flex gap-3">
              <Avatar
                size={40}
                icon={<RobotOutlined />}
                className="shrink-0 !bg-mf-sidebar"
              />
              <div className="min-w-0 max-w-[min(85%,720px)]">
                {streamingThinking && (
                  <div className="mb-2 rounded-xl border border-mf-border bg-mf-accent-soft px-4 py-3 text-xs text-mf-accent-soft-fg">
                    <div className="mb-1 flex items-center gap-1 font-semibold">
                      <BulbOutlined />
                      正在思考…
                    </div>
                    <div className="whitespace-pre-wrap break-words opacity-90">
                      {streamingThinking}
                    </div>
                  </div>
                )}
                <div className="rounded-2xl rounded-tl-md bg-mf-surface px-4 py-3 text-sm text-mf-text shadow-sm ring-1 ring-mf-border">
                  <div className="whitespace-pre-wrap break-words">
                    {streamingContent || (
                      <div className="animate-pulse text-mf-muted">
                        {streamingThinking ? '正在组织回复…' : '正在思考…'}
                      </div>
                    )}
                  </div>
                  {streamingSources?.length > 0 && (
                    <WikiSources sources={streamingSources} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className={
          isPage
            ? 'shrink-0 border-t border-mf-border bg-mf-surface px-4 py-4 md:px-6'
            : 'shrink-0 border-t border-mf-border bg-mf-surface p-3'
        }
      >
        <div className="mx-auto flex max-w-3xl gap-3">
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入问题，Enter 发送，Shift+Enter 换行"
            autoSize={{ minRows: 1, maxRows: 5 }}
            className="min-w-0 flex-1 rounded-xl"
            disabled={loading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            className="h-auto shrink-0 self-end rounded-xl !bg-mf-cta !border-mf-cta px-5"
          >
            发送
          </Button>
        </div>
        {isPage && (
          <div className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-mf-muted">
            模型：豆包 Seed 2.0 Lite · SSE 流式传输
          </div>
        )}
      </div>
    </div>
  );
}
