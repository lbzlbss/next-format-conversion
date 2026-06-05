'use client';

import { useCallback, useMemo, useState } from 'react';
import { A2UI_ENABLED } from '../lib/a2ui/constants.js';
import { buildToolResultSurfaces } from '../lib/a2ui/build-tool-result-surface.js';
import { useChatAttachments } from './useChatAttachments.js';
import { useChatStream } from './useChatStream.js';
import { CHAT_TOOLS } from '../lib/chat-tools/registry.js';
import { parseConfigForTool } from '../lib/chat-tools/parse-config.js';
import {
  defaultPromptForTool,
  resolveChatTool,
} from '../lib/chat-tools/resolve-tool.js';
import {
  formatToolSummary,
  runChatFileTool,
  runGenerateImageTool,
} from '../lib/chat-tools/run-chat-tool.js';

/**
 * @param {Object} options
 * @param {import('react').Dispatch<import('react').SetStateAction<Array<Record<string, unknown>>>>} options.setMessages
 * @param {{ toolKey?: string|null, useWiki?: boolean }} [options.chatContext]
 */
export function useChatComposer({ setMessages, chatContext = {} }) {
  const attachmentState = useChatAttachments();
  const stream = useChatStream({ setMessages, chatContext });
  const [toolRunning, setToolRunning] = useState(false);
  const [runningToolId, setRunningToolId] = useState(/** @type {string | null} */ (null));
  const [preferredToolId, setPreferredToolId] = useState(null);

  const runningSurfaces = useMemo(() => {
    if (!A2UI_ENABLED || !toolRunning || !runningToolId) return [];
    return buildToolResultSurfaces([
      { id: 'running', toolId: runningToolId, status: 'running' },
    ]);
  }, [toolRunning, runningToolId]);

  const send = useCallback(
    async (historyMessages, rawText) => {
      const text = String(rawText || '').trim();
      const att = attachmentState.attachments[0] ?? null;

      if (!text && !att) return;

      const toolId = resolveChatTool({
        file: att?.file ?? null,
        text,
        preferredToolId,
      });

      if (!toolId) {
        attachmentState.clearAttachments();
        await stream.sendMessage(historyMessages, text || '你好');
        return;
      }

      const tool = CHAT_TOOLS[toolId];
      const userContent = text || (att ? defaultPromptForTool(toolId, att.file) : '');

      if (tool.needsFile && !att) {
        await stream.sendMessage(historyMessages, `${userContent}\n\n（请先点击 📎 上传对应格式的文件）`);
        return;
      }

      const userAttachments = att
        ? [
            {
              id: att.id,
              name: att.name,
              size: att.size,
              previewUrl: att.previewUrl,
              kind: att.file.type || att.category,
            },
          ]
        : [];

      const userMsg = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: userContent,
        ...(userAttachments.length ? { attachments: userAttachments } : {}),
      };
      const baseHistory = [...historyMessages, userMsg];
      setMessages(baseHistory);
      attachmentState.clearAttachments();
      setPreferredToolId(null);

      /** @type {import('./useChatStream.js').ToolCall} */
      let toolCall = {
        id: `tc-${Date.now()}`,
        toolId,
        status: 'running',
        input: att ? parseConfigForTool(toolId, userContent) : { prompt: userContent },
      };

      setToolRunning(true);
      setRunningToolId(toolId);
      try {
        const result = att
          ? await runChatFileTool(toolId, att.file, toolCall.input)
          : await runGenerateImageTool(userContent);

        toolCall = {
          ...toolCall,
          status: 'success',
          input: result.config,
          output: {
            downloadUrl: result.downloadUrl,
            previewUrl: result.previewUrl,
            imageUrl: result.imageUrl,
            fileName: result.fileName,
            beforeBytes: result.beforeBytes,
            afterBytes: result.afterBytes,
          },
        };

        const apiUserContent = `${userContent}\n\n${formatToolSummary(result)}`;
        const wikiToolKey = CHAT_TOOLS[toolId]?.toolKey ?? chatContext.toolKey ?? null;
        const pendingSurfaces = A2UI_ENABLED ? buildToolResultSurfaces([toolCall]) : [];

        await stream.sendMessage(baseHistory, userContent, {
          appendUser: false,
          toolKey: wikiToolKey,
          pendingToolCalls: [toolCall],
          pendingSurfaces,
          apiUserContent,
        });
      } catch (err) {
        toolCall = {
          ...toolCall,
          status: 'error',
          error: err?.message || '工具执行失败',
        };
        setMessages((prev) => [
          ...prev,
          {
            id: `a-err-${Date.now()}`,
            role: 'assistant',
            content: toolCall.error,
            toolCalls: [toolCall],
            ...(A2UI_ENABLED ? { surfaces: buildToolResultSurfaces([toolCall]) } : {}),
          },
        ]);
      } finally {
        setToolRunning(false);
        setRunningToolId(null);
      }
    },
    [attachmentState, chatContext.toolKey, preferredToolId, setMessages, stream],
  );

  return {
    ...stream,
    ...attachmentState,
    send,
    toolRunning,
    runningSurfaces,
    busy: stream.loading || toolRunning,
    preferredToolId,
    setPreferredToolId,
  };
}
