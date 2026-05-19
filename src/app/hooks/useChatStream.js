'use client';

import { useCallback, useState } from 'react';

/**
 * @typedef {{ slug: string, title: string }} WikiSource
 */

async function consumeSseStream(reader, onEvent) {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';

    for (const block of parts) {
      const lines = block.split('\n');
      let eventType = 'message';
      let dataStr = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          dataStr = line.slice(6);
        }
      }

      if (!dataStr) continue;

      try {
        const payload = JSON.parse(dataStr);
        onEvent(eventType, payload);
        if (eventType === 'done' || eventType === 'error') return;
      } catch {
        // 忽略单行解析失败
      }
    }
  }
}

/**
 * @param {Object} options
 * @param {import('react').Dispatch<import('react').SetStateAction<Array<{id:string,role:string,content:string,thinking?:string,sources?:WikiSource[]}>>>} options.setMessages
 * @param {{ toolKey?: string|null, useWiki?: boolean }} [options.chatContext]
 */
export function useChatStream({ setMessages, chatContext = {} }) {
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [streamingSources, setStreamingSources] = useState([]);

  const sendMessage = useCallback(
    async (historyMessages, userText) => {
      const userMessage = { id: `u-${Date.now()}`, role: 'user', content: userText };
      const nextHistory = [...historyMessages, userMessage];

      setMessages(nextHistory);
      setLoading(true);
      setStreamingContent('');
      setStreamingThinking('');
      setStreamingSources([]);

      let fullContent = '';
      let fullThinking = '';
      /** @type {WikiSource[]} */
      let sources = [];

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: nextHistory.map((m) => ({ role: m.role, content: m.content })),
            context: {
              useWiki: chatContext.useWiki !== false,
              toolKey: chatContext.toolKey ?? null,
            },
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || res.statusText);
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('无响应体');

        await consumeSseStream(reader, (eventType, payload) => {
          if (eventType === 'sources' && Array.isArray(payload.items)) {
            sources = payload.items;
            setStreamingSources(payload.items);
          }
          if (eventType === 'thinking' && typeof payload.content === 'string') {
            fullThinking += payload.content;
            setStreamingThinking(fullThinking);
          }
          if (eventType === 'content' && typeof payload.content === 'string') {
            fullContent += payload.content;
            setStreamingContent(fullContent);
          }
          if (eventType === 'error') {
            throw new Error(payload.error || '流式响应异常');
          }
        });

        setStreamingContent('');
        setStreamingThinking('');
        setStreamingSources([]);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: fullContent,
            ...(fullThinking ? { thinking: fullThinking } : {}),
            ...(sources.length > 0 ? { sources } : {}),
          },
        ]);
      } catch (err) {
        console.error(err);
        setStreamingContent('');
        setStreamingThinking('');
        setStreamingSources([]);
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
    },
    [setMessages, chatContext.toolKey, chatContext.useWiki],
  );

  return {
    loading,
    streamingContent,
    streamingThinking,
    streamingSources,
    sendMessage,
  };
}
