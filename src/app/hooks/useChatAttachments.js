'use client';

import { useCallback, useState } from 'react';
import { getFileCategory } from '../lib/chat-tools/resolve-tool.js';
import { CHAT_MAX_BYTES } from '../lib/chat-tools/constants.js';

/**
 * @typedef {{
 *   id: string,
 *   file: File,
 *   name: string,
 *   size: number,
 *   previewUrl: string,
 *   category: 'gif'|'mp4'|'image',
 * }} ChatPendingAttachment
 */

export function useChatAttachments() {
  /** @type {[ChatPendingAttachment[], Function]} */
  const [attachments, setAttachments] = useState([]);

  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return { ok: false, error: '未选择文件' };

    const file = files[0];
    const category = getFileCategory(file);
    if (!category) {
      return {
        ok: false,
        error: '支持 GIF、MP4、JPEG/PNG/WebP 图片；复杂工具（VAP/SVGA/ZIP）请使用首页对应入口',
      };
    }

    const maxBytes = CHAT_MAX_BYTES[category];
    if (file.size > maxBytes) {
      return {
        ok: false,
        error: `文件过大，请上传小于 ${Math.floor(maxBytes / 1024 / 1024)}MB 的文件`,
      };
    }

    const att = {
      id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      name: file.name,
      size: file.size,
      previewUrl: URL.createObjectURL(file),
      category,
    };

    setAttachments((prev) => {
      for (const p of prev) {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      }
      return [att];
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
