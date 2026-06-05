import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../../../..");
const LOCAL_FONTS = [
  path.join(REPO_ROOT, "public/fonts/NotoSansSC-Regular.otf"),
  path.join(REPO_ROOT, "public/fonts/NotoSansSC-Regular.ttf"),
];

const REMOTE_FONTS = [
  "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf",
  "https://fonts.bunny.net/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.ttf",
];

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 52;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

/** @type {Uint8Array|null} */
let cachedFont = null;

function formatBytes(n) {
  if (!n || typeof n !== "number") return "—";
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

/**
 * @param {{ dataModel?: { tool?: Record<string, unknown> } }} surface
 * @returns {string[]}
 */
function surfaceToPdfLines(surface) {
  const t = surface?.dataModel?.tool;
  if (!t || typeof t !== "object") return [];

  const lines = [`[工具] ${t.label || t.toolId || "未知工具"}`];
  if (t.status === "error") {
    lines.push(`状态: 失败`);
    return lines;
  }
  if (typeof t.fileName === "string" && t.fileName) {
    lines.push(`文件: ${t.fileName}`);
  }
  if (t.beforeBytes && t.afterBytes) {
    lines.push(`体积: ${formatBytes(t.beforeBytes)} → ${formatBytes(t.afterBytes)}`);
    if (t.savedPercent) lines.push(`约减小 ${t.savedPercent}%`);
  }
  if (typeof t.downloadUrl === "string" && t.downloadUrl) {
    lines.push(`下载: ${t.downloadUrl}`);
  }
  if (typeof t.imageUrl === "string" && t.imageUrl) {
    lines.push(`图片: ${t.imageUrl}`);
  }
  return lines;
}

/**
 * @param {{ toolId?: string, status?: string, error?: string, output?: Record<string, unknown> }} tc
 * @returns {string[]}
 */
function toolCallToPdfLines(tc) {
  if (!tc) return [];
  const lines = [`[工具] ${tc.toolId || "未知工具"}`];
  if (tc.status === "error") {
    lines.push(`状态: 失败`);
    if (tc.error) lines.push(String(tc.error));
    return lines;
  }
  const out = tc.output;
  if (!out) return lines;
  if (typeof out.fileName === "string" && out.fileName) {
    lines.push(`文件: ${out.fileName}`);
  }
  if (out.beforeBytes && out.afterBytes) {
    lines.push(`体积: ${formatBytes(out.beforeBytes)} → ${formatBytes(out.afterBytes)}`);
  }
  if (typeof out.downloadUrl === "string" && out.downloadUrl) {
    lines.push(`下载: ${out.downloadUrl}`);
  }
  if (typeof out.imageUrl === "string" && out.imageUrl) {
    lines.push(`图片: ${out.imageUrl}`);
  }
  return lines;
}

async function loadChineseFont() {
  if (cachedFont) return cachedFont;

  const localPath = LOCAL_FONTS.find((p) => fs.existsSync(p));
  if (localPath) {
    cachedFont = new Uint8Array(fs.readFileSync(localPath));
    return cachedFont;
  }

  let lastErr = null;
  for (const url of REMOTE_FONTS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cachedFont = new Uint8Array(await res.arrayBuffer());
      return cachedFont;
    } catch (e) {
      lastErr = e;
    }
  }

  throw new Error(
    `无法加载中文字体。请将 NotoSansSC-Regular.otf 放到 public/fonts/，或检查网络。${lastErr?.message || ""}`,
  );
}

/**
 * @param {string} text
 * @param {import('pdf-lib').PDFFont} font
 * @param {number} fontSize
 * @param {number} maxWidth
 */
function wrapText(text, font, fontSize, maxWidth) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const char of paragraph) {
      const next = line + char;
      const width = font.widthOfTextAtSize(next, fontSize);
      if (width > maxWidth && line.length > 0) {
        lines.push(line);
        line = char;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

/**
 * @param {Object} ctx
 * @param {import('pdf-lib').PDFPage} ctx.page
 * @param {import('pdf-lib').PDFFont} ctx.font
 * @param {import('pdf-lib').PDFDocument} ctx.pdfDoc
 * @param {number} ctx.y
 * @param {string} text
 * @param {Object} opts
 */
function drawLines(ctx, text, opts) {
  const {
    fontSize = 11,
    color = rgb(0.06, 0.09, 0.15),
    lineHeight = fontSize * 1.45,
    indent = 0,
  } = opts;

  const lines = wrapText(text, ctx.font, fontSize, CONTENT_WIDTH - indent);
  for (const line of lines) {
    if (ctx.y < MARGIN + lineHeight) {
      ctx.page = ctx.pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      ctx.y = PAGE_HEIGHT - MARGIN;
    }
    if (line) {
      ctx.page.drawText(line, {
        x: MARGIN + indent,
        y: ctx.y,
        size: fontSize,
        font: ctx.font,
        color,
      });
    }
    ctx.y -= lineHeight;
  }
  return ctx;
}

/**
 * @param {Object} options
 * @param {string} options.title
 * @param {Array<{ role: string, content: string, thinking?: string, sources?: Array<{ title: string, slug?: string }>, surfaces?: unknown[], toolCalls?: unknown[] }>} options.messages
 * @param {boolean} [options.includeThinking]
 */
export async function generateChatPdfBuffer({
  title,
  messages,
  includeThinking = true,
}) {
  const fontBytes = await loadChineseFont();
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });

  pdfDoc.setTitle(title);
  pdfDoc.setAuthor("MediaFlow AI 对话助手");

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const ctx = { pdfDoc, page, font, y: PAGE_HEIGHT - MARGIN };

  const titleWidth = font.widthOfTextAtSize(title, 18);
  page.drawText(title, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y: ctx.y,
    size: 18,
    font,
    color: rgb(0.06, 0.09, 0.15),
  });
  ctx.y -= 28;

  const timeStr = `导出时间：${new Date().toLocaleString("zh-CN")}`;
  const timeWidth = font.widthOfTextAtSize(timeStr, 10);
  page.drawText(timeStr, {
    x: (PAGE_WIDTH - timeWidth) / 2,
    y: ctx.y,
    size: 10,
    font,
    color: rgb(0.39, 0.45, 0.55),
  });
  ctx.y -= 36;

  for (const msg of messages) {
    if (!msg?.content?.trim()) continue;

    const roleLabel =
      msg.role === "user" ? "用户" : msg.role === "assistant" ? "助手" : msg.role;

    drawLines(ctx, `【${roleLabel}】`, {
      fontSize: 12,
      color: rgb(0.12, 0.16, 0.23),
      lineHeight: 16,
    });
    ctx.y -= 4;

    drawLines(ctx, msg.content.trim(), { fontSize: 11, lineHeight: 16 });

    if (includeThinking && msg.thinking?.trim()) {
      ctx.y -= 6;
      drawLines(ctx, "思考过程：", {
        fontSize: 9,
        color: rgb(0.28, 0.33, 0.41),
        lineHeight: 13,
      });
      drawLines(ctx, msg.thinking.trim(), {
        fontSize: 9,
        color: rgb(0.28, 0.33, 0.41),
        lineHeight: 13,
      });
    }

    if (msg.sources?.length > 0) {
      ctx.y -= 6;
      drawLines(ctx, "参考 Wiki：", {
        fontSize: 9,
        color: rgb(0.11, 0.31, 0.85),
        lineHeight: 13,
      });
      for (const s of msg.sources) {
        drawLines(ctx, `· ${s.title || s.slug || "条目"}`, {
          fontSize: 9,
          color: rgb(0.11, 0.31, 0.85),
          lineHeight: 13,
          indent: 12,
        });
      }
    }

    const surfaceLines = Array.isArray(msg.surfaces)
      ? msg.surfaces.flatMap((s) => surfaceToPdfLines(s))
      : [];
    const toolLines =
      surfaceLines.length === 0 && Array.isArray(msg.toolCalls)
        ? msg.toolCalls.flatMap((tc) => toolCallToPdfLines(tc))
        : [];

    const toolSummary = [...surfaceLines, ...toolLines];
    if (toolSummary.length > 0) {
      ctx.y -= 6;
      drawLines(ctx, "工具结果摘要：", {
        fontSize: 9,
        color: rgb(0.28, 0.33, 0.41),
        lineHeight: 13,
      });
      for (const line of toolSummary) {
        drawLines(ctx, `· ${line}`, {
          fontSize: 9,
          color: rgb(0.28, 0.33, 0.41),
          lineHeight: 13,
          indent: 12,
        });
      }
    }

    ctx.y -= 8;
    if (ctx.y < MARGIN + 20) {
      ctx.page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      ctx.y = PAGE_HEIGHT - MARGIN;
    } else {
      const y = ctx.y;
      ctx.page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_WIDTH - MARGIN, y },
        thickness: 0.5,
        color: rgb(0.89, 0.91, 0.94),
      });
      ctx.y -= 16;
    }
  }

  if (ctx.y < MARGIN + 20) {
    ctx.page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    ctx.y = PAGE_HEIGHT - MARGIN;
  }

  const footer = "由 MediaFlow AI 对话助手导出";
  const footerWidth = font.widthOfTextAtSize(footer, 9);
  ctx.page.drawText(footer, {
    x: (PAGE_WIDTH - footerWidth) / 2,
    y: Math.max(MARGIN, ctx.y - 8),
    size: 9,
    font,
    color: rgb(0.58, 0.64, 0.72),
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}
