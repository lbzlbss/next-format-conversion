#!/usr/bin/env node
/**
 * 确保 PDF 导出用的中文字体存在（构建/开发前可选执行）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const FONT_DIR = path.join(REPO_ROOT, "public/fonts");
const TARGETS = [
  path.join(FONT_DIR, "NotoSansSC-Regular.ttf"),
  path.join(FONT_DIR, "NotoSansSC-Regular.otf"),
];

const REMOTE = [
  "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf",
  "https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf",
];

function hasFont() {
  return TARGETS.some((p) => fs.existsSync(p) && fs.statSync(p).size > 100_000);
}

async function download() {
  fs.mkdirSync(FONT_DIR, { recursive: true });
  const dest = path.join(FONT_DIR, "NotoSansSC-Regular.otf");

  for (const url of REMOTE) {
    try {
      console.log(`[chat-pdf-font] 下载: ${url}`);
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(dest, buf);
      console.log(`[chat-pdf-font] 已写入 ${dest} (${(buf.length / 1024 / 1024).toFixed(2)} MB)`);
      return;
    } catch (e) {
      console.warn(`[chat-pdf-font] 失败: ${e.message}`);
    }
  }
  throw new Error("字体下载失败，PDF 中文导出将不可用");
}

if (hasFont()) {
  console.log("[chat-pdf-font] 字体已存在，跳过");
  process.exit(0);
}

await download();
