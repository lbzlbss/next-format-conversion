'use client';

import { useMemo } from 'react';

/**
 * 对话状态 → 数字人动作
 * @param {{ busy: boolean, toolRunning: boolean, streamingContent: string, streamingThinking: string }} p
 * @returns {import('../lib/digital-human/constants.js').AvatarAnimState}
 */
export function useDigitalHumanState({
  busy,
  toolRunning,
  streamingContent,
  streamingThinking,
}) {
  return useMemo(() => {
    if (busy || toolRunning || streamingThinking) return 'thinking';
    if (streamingContent) return 'speaking';
    return 'idle';
  }, [busy, toolRunning, streamingContent, streamingThinking]);
}
