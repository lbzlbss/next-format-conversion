/**
 * 调用 /api/chat/pdf 并触发浏览器下载
 * @param {Object} options
 * @param {string} [options.title]
 * @param {string} [options.filename]
 * @param {Array<{ role: string, content: string, thinking?: string, sources?: unknown[] }>} options.messages
 * @param {boolean} [options.includeThinking]
 */
export async function downloadChatPdf({
  title,
  filename,
  messages,
  includeThinking = true,
}) {
  const res = await fetch("/api/chat/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, filename, messages, includeThinking }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText || "PDF 生成失败");
  }

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i);
  const nameFromHeader = match?.[1] ? decodeURIComponent(match[1]) : null;
  const downloadName = nameFromHeader || `${filename || "mediaflow-chat"}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = downloadName.endsWith(".pdf") ? downloadName : `${downloadName}.pdf`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * 从对话列表筛出可导出消息（跳过欢迎语）
 * @param {Array<{ id?: string, role: string, content: string, thinking?: string, sources?: unknown[] }>} messages
 */
export function messagesForPdfExport(messages) {
  return messages
    .filter((m) => m.id !== "welcome" && m.content?.trim())
    .map((m) => ({
      role: m.role,
      content: m.content,
      ...(m.thinking ? { thinking: m.thinking } : {}),
      ...(m.sources?.length ? { sources: m.sources } : {}),
    }));
}
