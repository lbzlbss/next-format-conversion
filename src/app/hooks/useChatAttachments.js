'use client';

import { useCallback, useState } from 'react';
import { CHAT_GIF_MAX_BYTES } from '../lib/chat-tools/run-gif-to-webp.js';
import { detectToolForFile } from '../lib/chat-tools/registry.js';

/**
 * @typedef {{
 *   id: string,
 *   file: File,
 *   name: string,
 *   size: number,
 *   previewUrl: string,
 *   toolId: string | null,
 * }} ChatPendingAttachment
 */

export function useChatAttachments() {
  /** @type {[ChatPendingAttachment[], Function]} */
  const [attachments, setAttachments] = useState([]);

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return { ok: false, error: '未选择文件' };

    const next = [];
    for (const file of files) {
      const toolId = detectToolForFile(file);
      if (!toolId) {
        return { ok: false, error: '对话附件目前仅支持 GIF 动图' };
      }
      if (file.size > CHAT_GIF_MAX_BYTES) {
        return {
          ok: false,
          error: `文件过大，请上传小于 ${Math.floor(CHAT_GIF_MAX_BYTES / 1024 / 1024)}MB 的 GIF`,
        };
      }
      next.push({
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
        toolId,
      });
    }

    setAttachments((prev) => {
      for (const p of prev) {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      }
      return next.slice(0, 1);
    });
    return { ok: true };
  }, []);

  const removeAttachment = useCallback((id) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      for (const p of prev) {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      }
      return [];
    });
  }, []);

  return {
    attachments,
    addFiles,
    removeAttachment,
    clearAttachments,
  };
}
