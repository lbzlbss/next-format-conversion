'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, Avatar } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, CloseOutlined } from '@ant-design/icons';

const { TextArea } = Input;

const AiChatAssistant = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: '你好，我是 MediaFlow 的网站全能助手，兼具 AI 创作专家与八字命理师双重身份。\n\n你可以问我：\n· 文生图/图生图、视频转换（静止图转视频、参数设置）\n· 生辰八字简析与转运建议\n· 操作步骤与参数（如 ControlNet、Seed、运动强度、重绘幅度）',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);
    setStreamingContent('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || res.statusText);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        throw new Error('无响应体');
      }

      let buffer = '';
      let fullContent = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const data = JSON.parse(trimmed);
            if (typeof data.content === 'string') {
              fullContent += data.content;
              setStreamingContent(fullContent);
            }
            if (data.done === true) break;
          } catch (_) {
            // 忽略非 JSON 行
          }
        }
      }

      setStreamingContent('');
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', content: fullContent },
      ]);
    } catch (err) {
      console.error(err);
      setStreamingContent('');
      setMessages((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: err?.message || '回复失败，请检查网络或稍后重试。',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* 右下角悬浮按钮 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[1000] flex size-14 items-center justify-center rounded-full bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)] text-white shadow-lg transition hover:scale-105 hover:shadow-xl"
        aria-label="打开 AI 助手"
      >
        <RobotOutlined className="text-[24px]" />
      </button>

      {/* 悬浮聊天框 */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-[1000] flex h-[520px] w-[400px] flex-col overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white shadow-xl"
          style={{ maxHeight: 'calc(100vh - 120px)' }}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)]">
                <RobotOutlined className="text-white" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[14px] font-bold text-[#0f172a]">AI 对话助手</div>
                <div className="text-[11px] text-[#94a3b8]">创作专家 · 视频转换 · 八字命理</div>
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

          <div
            ref={listRef}
            className="min-h-0 flex-1 overflow-y-auto p-4"
          >
            <div className="space-y-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <Avatar
                    size={36}
                    icon={m.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                    className={
                      m.role === 'user'
                        ? 'shrink-0 bg-[#6366f1]'
                        : 'shrink-0 bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)]'
                    }
                  />
                  <div
                    className={
                      m.role === 'user'
                        ? 'max-w-[85%] rounded-2xl rounded-tr-md bg-[#6366f1] px-4 py-2 text-[13px] text-white'
                        : 'max-w-[85%] rounded-2xl rounded-tl-md bg-[#f1f5f9] px-4 py-2 text-[13px] text-[#0f172a]'
                    }
                  >
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  </div>
                </div>
              ))}
              {(loading || streamingContent) && (
                <div className="flex gap-3">
                  <Avatar
                    size={36}
                    icon={<RobotOutlined />}
                    className="shrink-0 bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)]"
                  />
                  <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-[#f1f5f9] px-4 py-2 text-[13px] text-[#0f172a]">
                    <div className="whitespace-pre-wrap break-words">
                      {streamingContent || <span className="animate-pulse text-[#64748b]">正在思考…</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-[#e2e8f0] p-3">
            <div className="flex gap-2">
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
                autoSize={{ minRows: 1, maxRows: 4 }}
                className="min-w-0 flex-1 rounded-xl"
                disabled={loading}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleSend}
                loading={loading}
                className="shrink-0 rounded-xl bg-[linear-gradient(135deg,#6366f1_0%,#a855f7_100%)]"
              >
                发送
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AiChatAssistant;
