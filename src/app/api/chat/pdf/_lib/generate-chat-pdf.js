import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../../../../..");
const LOCAL_FONTS = [
  path.join(REPO_ROOT, "public/fonts/NotoSansSC-Regular.otf"),
  path.join(REPO_ROOT, "public/fonts/NotoSansSC-Regular.ttf"),
];

const REMOTE_FONTS = [
  "https://fonts.bunny.net/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.ttf",
  "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf",
];

/** @type {Buffer|null} */
let cachedFont = null;

async function loadChineseFont() {
  if (cachedFont) return cachedFont;

  const localPath = LOCAL_FONTS.find((p) => fs.existsSync(p));
  if (localPath) {
    cachedFont = fs.readFileSync(localPath);
    return cachedFont;
  }

  let lastErr = null;
  for (const url of REMOTE_FONTS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      cachedFont = Buffer.from(await res.arrayBuffer());
      return cachedFont;
    } catch (e) {
      lastErr = e;
    }
  }

  throw new Error(
    `无法加载中文字体。请将 NotoSansSC-Regular.ttf 放到 public/fonts/，或检查网络。${lastErr?.message || ""}`,
  );
}

/**
 * @param {Object} options
 * @param {string} options.title
 * @param {Array<{ role: string, content: string, thinking?: string, sources?: Array<{ title: string, slug?: string }> }>} options.messages
 * @param {boolean} [options.includeThinking]
 */
export async function generateChatPdfBuffer({
  title,
  messages,
  includeThinking = true,
}) {
  const font = await loadChineseFont();
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 52, right: 52 },
    info: {
      Title: title,
      Author: "MediaFlow AI 对话助手",
    },
  });

  doc.registerFont("body", font);
  doc.registerFont("body-bold", font);

  const chunks = [];
  doc.on("data", (c) => chunks.push(c));

  const ended = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.font("body").fontSize(18).text(title, { align: "center" });
  doc.moveDown(0.5);
  doc
    .fontSize(10)
    .fillColor("#64748b")
    .text(`导出时间：${new Date().toLocaleString("zh-CN")}`, { align: "center" });
  doc.fillColor("#0f172a");
  doc.moveDown(1.5);

  for (const msg of messages) {
    if (!msg?.content?.trim()) continue;

    const roleLabel =
      msg.role === "user" ? "用户" : msg.role === "assistant" ? "助手" : msg.role;

    doc.font("body-bold").fontSize(12).fillColor("#1e293b").text(`【${roleLabel}】`);
    doc.moveDown(0.35);

    doc.font("body").fontSize(11).fillColor("#0f172a").text(msg.content.trim(), {
      align: "left",
      lineGap: 4,
    });

    if (includeThinking && msg.thinking?.trim()) {
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor("#475569").text("思考过程：", { continued: false });
      doc.text(msg.thinking.trim(), { lineGap: 3 });
      doc.fillColor("#0f172a");
    }

    if (msg.sources?.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(9).fillColor("#1d4ed8").text("参考 Wiki：");
      for (const s of msg.sources) {
        doc.text(`· ${s.title || s.slug || "条目"}`, { indent: 12 });
      }
      doc.fillColor("#0f172a");
    }

    doc.moveDown(1.2);
    doc
      .strokeColor("#e2e8f0")
      .lineWidth(0.5)
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .stroke();
    doc.moveDown(1);
  }

  doc.fontSize(9).fillColor("#94a3b8").text("由 MediaFlow AI 对话助手导出", {
    align: "center",
  });

  doc.end();
  return ended;
}

export function bufferToWebReadable(buffer) {
  return Readable.toWeb(Readable.from(buffer));
}
