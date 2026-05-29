'use client';

import { useCallback, useState } from 'react';
import { useChatAttachments } from './useChatAttachments.js';
import { useChatStream } from './useChatStream.js';
import { CHAT_TOOL_IDS } from '../lib/chat-tools/registry.js';
import { parseGifConfigFromText } from '../lib/chat-tools/parse-gif-config.js';
import {
  formatGifToWebpToolSummary,
  runGifToWebp,
} from '../lib/chat-tools/run-gif-to-webp.js';

/**
 * @param {Object} options
 * @param {import('react').Dispatch<import('react').SetStateAction<Array<Record<string, unknown>>>>} options.setMessages
 * @param {{ toolKey?: string|null, useWiki?: boolean }} [options.chatContext]
 */
export function useChatComposer({ setMessages, chatContext = {} }) {
  const attachmentState = useChatAttachments();
  const stream = useChatStream({ setMessages, chatContext });
  const [toolRunning, setToolRunning] = useState(false);

  const send = useCallback(
    async (historyMessages, rawText) => {
      const text = String(rawText || '').trim();
      const gifAtt = attachmentState.attachments[0] ?? null;

      if (!text && !gifAtt) return;

      const userContent =
        text || (gifAtt ? `请将附件「${gifAtt.name}」转换为 WebP 并提供下载` : '');

      if (!gifAtt) {
        attachmentState.clearAttachments();
        await stream.sendMessage(historyMessages, userContent);
        return;
      }

      const userAttachments = [
        {
          id: gifAtt.id,
          name: gifAtt.name,
          size: gifAtt.size,
          previewUrl: gifAtt.previewUrl,
          kind: 'image/gif',
        },
      ];

      const userMsg = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: userContent,
        attachments: userAttachments,
      };
      const baseHistory = [...historyMessages, userMsg];
      setMessages(baseHistory);
      attachmentState.clearAttachments();

      const config = parseGifConfigFromText(userContent);
      /** @type {import('./useChatStream.js').ToolCall} */
      let toolCall = {
        id: `tc-${Date.now()}`,
        toolId: CHAT_TOOL_IDS.GIF_TO_WEBP,
        status: 'running',
        input: config,
      };

      setToolRunning(true);
      try {
        const result = await runGifToWebp(gifAtt.file, config);
        toolCall = {
          ...toolCall,
          status: 'success',
          input: result.config,
          output: {
            downloadUrl: result.downloadUrl,
            fileName: result.fileName,
            beforeBytes: result.beforeBytes,
            afterBytes: result.afterBytes,
          },
        };

        const apiUserContent = `${userContent}\n\n${formatGifToWebpToolSummary(result)}`;

        await stream.sendMessage(baseHistory, userContent, {
          appendUser: false,
          toolKey: 'gifToWebp',
          pendingToolCalls: [toolCall],
          apiUserContent,
        });
      } catch (err) {
        toolCall = {
          ...toolCall,
          status: 'error',
          error: err?.message || '转换失败',
        };
        setMessages((prev) => [
          ...prev,
          {
            id: `a-err-${Date.now()}`,
            role: 'assistant',
            content: toolCall.error,
            toolCalls: [toolCall],
          },
        ]);
      } finally {
        setToolRunning(false);
      }
    },
    [attachmentState, chatContext, setMessages, stream],
  );

  return {
    ...stream,
    ...attachmentState,
    send,
    toolRunning,
    busy: stream.loading || toolRunning,
  };
}
