'use client';

import { useCallback, useState } from 'react';

/**
 * @typedef {{ slug: string, title: string }} WikiSource
 * @typedef {{
 *   id: string,
 *   toolId: string,
 *   status: 'pending' | 'running' | 'success' | 'error',
 *   input?: Record<string, unknown>,
 *   output?: {
 *     downloadUrl?: string,
 *     previewUrl?: string,
 *     imageUrl?: string,
 *     fileName: string,
 *     beforeBytes?: number,
 *     afterBytes?: number,
 *   },
 *   error?: string,
 * }} ToolCall
 * @typedef {{
 *   id: string,
 *   name: string,
 *   size: number,
 *   previewUrl?: string,
 *   kind?: string,
 * }} ChatAttachmentMeta
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
 * @param {import('react').Dispatch<import('react').SetStateAction<Array<{
 *   id: string,
 *   role: string,
 *   content: string,
 *   thinking?: string,
 *   sources?: WikiSource[],
 *   attachments?: ChatAttachmentMeta[],
 *   toolCalls?: ToolCall[],
 * }>>>} options.setMessages
 * @param {{ toolKey?: string|null, useWiki?: boolean }} [options.chatContext]
 */
export function useChatStream({ setMessages, chatContext = {} }) {
  const [loading, setLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');
  const [streamingSources, setStreamingSources] = useState([]);
  const [streamingToolCalls, setStreamingToolCalls] = useState([]);

  const sendMessage = useCallback(
    /**
     * @param {Array<{id:string,role:string,content:string,attachments?:ChatAttachmentMeta[],toolCalls?:ToolCall[]}>} historyMessages
     * @param {string} userText
     * @param {{ appendUser?: boolean, toolKey?: string|null, pendingToolCalls?: ToolCall[], apiUserContent?: string }} [options]
     */
    async (historyMessages, userText, options = {}) => {
      const {
        appendUser = true,
        toolKey: toolKeyOverride = null,
        pendingToolCalls = [],
        apiUserContent,
      } = options;

      const text = String(userText || '').trim();
      if (!text && appendUser) return;

      /** @type {Array<{id:string,role:string,content:string,attachments?:ChatAttachmentMeta[],toolCalls?:ToolCall[]}>} */
      let nextHistory = historyMessages;

      if (appendUser) {
        const userMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
        nextHistory = [...historyMessages, userMessage];
      }

      setMessages(nextHistory);
      setLoading(true);
      setStreamingContent('');
      setStreamingThinking('');
      setStreamingSources([]);
      setStreamingToolCalls(pendingToolCalls);

      let fullContent = '';
      let fullThinking = '';
      /** @type {WikiSource[]} */
      let sources = [];

      try {
        /** @type {{ role: string, content: string }[]} */
        let messagesForApi = nextHistory.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        if (apiUserContent) {
          let lastUserIdx = -1;
          for (let i = messagesForApi.length - 1; i >= 0; i--) {
            if (messagesForApi[i].role === 'user') {
              lastUserIdx = i;
              break;
            }
          }
          if (lastUserIdx >= 0) {
            messagesForApi = messagesForApi.map((m, i) =>
              i === lastUserIdx ? { ...m, content: apiUserContent } : m,
            );
          } else {
            messagesForApi = [...messagesForApi, { role: 'user', content: apiUserContent }];
          }
        }

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: messagesForApi,
            context: {
              useWiki: chatContext.useWiki !== false,
              toolKey: toolKeyOverride ?? chatContext.toolKey ?? null,
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
        setStreamingToolCalls([]);

        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: fullContent,
            ...(fullThinking ? { thinking: fullThinking } : {}),
            ...(sources.length > 0 ? { sources } : {}),
            ...(pendingToolCalls.length > 0 ? { toolCalls: pendingToolCalls } : {}),
          },
        ]);
      } catch (err) {
        console.error(err);
        setStreamingContent('');
        setStreamingThinking('');
        setStreamingSources([]);
        setStreamingToolCalls([]);

        const errMsg = err?.message || '回复失败，请检查网络或稍后重试。';
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            content: pendingToolCalls.some((t) => t.status === 'success')
              ? `转换已完成，但解说生成失败：${errMsg}`
              : errMsg,
            ...(pendingToolCalls.length > 0 ? { toolCalls: pendingToolCalls } : {}),
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
    streamingToolCalls,
    sendMessage,
  };
}
