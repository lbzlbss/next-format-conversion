'use client';

import { useCallback, useMemo, useState } from 'react';
import { A2UI_ENABLED, A2UI_PARAM_FORM_ENABLED } from '../lib/a2ui/constants.js';
import { buildToolResultSurfaces } from '../lib/a2ui/build-tool-result-surface.js';
import {
  buildParamFormSurface,
  mergeParamFormConfig,
} from '../lib/a2ui/build-param-form-surface.js';
import { shouldShowParamForm } from '../lib/a2ui/detect-fuzzy-intent.js';
import { submitA2uiAction } from '../lib/a2ui/submit-a2ui-action.js';
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
 * @typedef {{
 *   toolId: string,
 *   userContent: string,
 *   file: File,
 *   baseHistory: Array<Record<string, unknown>>,
 *   surfaceId: string,
 * }} PendingToolSession
 */

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
  const [awaitingA2uiAction, setAwaitingA2uiAction] = useState(false);
  const [pendingToolSession, setPendingToolSession] = useState(
    /** @type {PendingToolSession | null} */ (null),
  );

  const runningSurfaces = useMemo(() => {
    if (!A2UI_ENABLED || !toolRunning || !runningToolId) return [];
    return buildToolResultSurfaces([
      { id: 'running', toolId: runningToolId, status: 'running' },
    ]);
  }, [toolRunning, runningToolId]);

  const executeFileTool = useCallback(
    async (
      toolId,
      file,
      userContent,
      baseHistory,
      /** @type {Record<string, unknown>} */ inputConfig,
    ) => {
      /** @type {import('./useChatStream.js').ToolCall} */
      let toolCall = {
        id: `tc-${Date.now()}`,
        toolId,
        status: 'running',
        input: inputConfig,
      };

      setToolRunning(true);
      setRunningToolId(toolId);
      try {
        const result = await runChatFileTool(toolId, file, inputConfig);

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
            ...(err?.code === 'QUOTA_EXCEEDED'
              ? { authPrompt: { message: toolCall.error, detail: err.detail } }
              : {}),
            ...(A2UI_ENABLED ? { surfaces: buildToolResultSurfaces([toolCall]) } : {}),
          },
        ]);
      } finally {
        setToolRunning(false);
        setRunningToolId(null);
      }
    },
    [chatContext.toolKey, setMessages, stream],
  );

  const handleSurfaceAction = useCallback(
    async (surfaceId, actionName, dataModel) => {
      const session = pendingToolSession;
      if (!session || session.surfaceId !== surfaceId) return;

      if (actionName === 'cancel_tool') {
        setPendingToolSession(null);
        setAwaitingA2uiAction(false);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-cancel-${Date.now()}`,
            role: 'assistant',
            content: '已取消本次转换。可重新上传附件并描述需求。',
          },
        ]);
        return;
      }

      if (actionName !== 'start_tool') return;

      try {
        await submitA2uiAction({ surfaceId, action: actionName, dataModel });
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-err-${Date.now()}`,
            role: 'assistant',
            content: err?.message || '参数确认失败',
          },
        ]);
        return;
      }

      const params =
        dataModel?.params && typeof dataModel.params === 'object'
          ? /** @type {Record<string, unknown>} */ (dataModel.params)
          : {};
      const { toolId, config } = mergeParamFormConfig(
        session.toolId,
        session.userContent,
        params,
      );

      setPendingToolSession(null);
      setAwaitingA2uiAction(false);

      await executeFileTool(
        toolId,
        session.file,
        session.userContent,
        session.baseHistory,
        config,
      );
    },
    [executeFileTool, pendingToolSession, setMessages],
  );

  const send = useCallback(
    async (historyMessages, rawText) => {
      const text = String(rawText || '').trim();
      const att = attachmentState.attachments[0] ?? null;

      if (!text && !att) return;

      if (awaitingA2uiAction) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-hint-${Date.now()}`,
            role: 'assistant',
            content: '请先在上方的参数表单中点击「开始转换」或「取消」。',
          },
        ]);
        return;
      }

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

      if (
        A2UI_PARAM_FORM_ENABLED &&
        att &&
        tool.needsFile &&
        shouldShowParamForm({ toolId, text: userContent, needsFile: true })
      ) {
        const surface = buildParamFormSurface(toolId, userContent, {
          fileName: att.name,
        });
        setPendingToolSession({
          toolId,
          userContent,
          file: att.file,
          baseHistory,
          surfaceId: surface.surfaceId,
        });
        setAwaitingA2uiAction(true);
        setMessages((prev) => [
          ...prev,
          {
            id: `a-params-${Date.now()}`,
            role: 'assistant',
            content: '请确认转换参数，满意后点击「开始转换」。',
            surfaces: [surface],
          },
        ]);
        return;
      }

      if (att) {
        const inputConfig = parseConfigForTool(toolId, userContent);
        await executeFileTool(toolId, att.file, userContent, baseHistory, inputConfig);
        return;
      }

      /** @type {import('./useChatStream.js').ToolCall} */
      let toolCall = {
        id: `tc-${Date.now()}`,
        toolId,
        status: 'running',
        input: { prompt: userContent },
      };

      setToolRunning(true);
      setRunningToolId(toolId);
      try {
        const result = await runGenerateImageTool(userContent);

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
            ...(err?.code === 'QUOTA_EXCEEDED'
              ? { authPrompt: { message: toolCall.error, detail: err.detail } }
              : {}),
            ...(A2UI_ENABLED ? { surfaces: buildToolResultSurfaces([toolCall]) } : {}),
          },
        ]);
      } finally {
        setToolRunning(false);
        setRunningToolId(null);
      }
    },
    [
      attachmentState,
      awaitingA2uiAction,
      chatContext.toolKey,
      executeFileTool,
      preferredToolId,
      setMessages,
      stream,
    ],
  );

  return {
    ...stream,
    ...attachmentState,
    send,
    toolRunning,
    runningSurfaces,
    awaitingA2uiAction,
    interactiveSurfaceId: pendingToolSession?.surfaceId ?? null,
    handleSurfaceAction,
    busy: stream.loading || toolRunning,
    preferredToolId,
    setPreferredToolId,
  };
}
