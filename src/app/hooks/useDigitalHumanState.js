'use client';

import { useMemo } from 'react';

/**
 * 对话状态 → 数字人动作
 * @param {{ busy: boolean, toolRunning: boolean, streamingContent: string, streamingThinking: string, awaitingA2uiAction?: boolean }} p
 * @returns {import('../lib/digital-human/constants.js').AvatarAnimState}
 */
export function useDigitalHumanState({
  busy,
  toolRunning,
  streamingContent,
  streamingThinking,
  awaitingA2uiAction = false,
}) {
  return useMemo(() => {
    if (awaitingA2uiAction) return 'idle';
    if (busy || toolRunning || streamingThinking) return 'thinking';
    if (streamingContent) return 'speaking';
    return 'idle';
  }, [awaitingA2uiAction, busy, toolRunning, streamingContent, streamingThinking]);
}
