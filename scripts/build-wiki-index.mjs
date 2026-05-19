#!/usr/bin/env node
// 扫描 content/wiki 下所有 .md，生成 data/wiki-index.json
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const WIKI_DIR = path.join(ROOT, "content/wiki");
/** 放在 data/ 而非 public/，避免 dev 时写入 public 触发整页刷新 */
const OUT_FILE = path.join(ROOT, "data/wiki-index.json");

const MAX_CHUNK_CHARS = 1200;

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { meta: {}, body: raw.trim() };
  }
  const yaml = match[1];
  const body = match[2].trim();
  const meta = {};
  for (const line of yaml.split("\n")) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      val = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ""));
      meta[key] = val;
    } else {
      meta[key] = val.replace(/^['"]|['"]$/g, "");
    }
  }
  return { meta, body };
}

function slugifyHeading(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "");
}

function chunkByH2(slug, title, category, tags, toolKey, body) {
  const chunks = [];
  const sections = body.split(/^## /m);
  const intro = sections[0]?.trim();
  if (intro) {
    chunks.push({
      id: `${slug}#intro`,
      slug,
      title,
      heading: "概述",
      category,
      tags: tags || [],
      toolKey: toolKey || null,
      content: intro.slice(0, MAX_CHUNK_CHARS),
    });
  }
  for (let i = 1; i < sections.length; i++) {
    const part = sections[i];
    const nl = part.indexOf("\n");
    const heading = nl >= 0 ? part.slice(0, nl).trim() : part.trim();
    const content = (nl >= 0 ? part.slice(nl + 1) : "").trim();
    if (!content) continue;
    const anchor = slugifyHeading(heading) || `section-${i}`;
    chunks.push({
      id: `${slug}#${anchor}`,
      slug,
      title,
      heading,
      category,
      tags: tags || [],
      toolKey: toolKey || null,
      content: content.slice(0, MAX_CHUNK_CHARS),
    });
  }
  return chunks;
}

function walkMdFiles(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walkMdFiles(full, list);
    else if (name.endsWith(".md")) list.push(full);
  }
  return list;
}

function main() {
  const files = walkMdFiles(WIKI_DIR);
  const articles = [];
  const chunks = [];

  let metaConfig = { categories: [] };
  const metaPath = path.join(WIKI_DIR, "_meta.json");
  if (fs.existsSync(metaPath)) {
    metaConfig = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  }

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf8");
    const { meta, body } = parseFrontmatter(raw);
    if (!meta.slug || !meta.title) {
      console.warn(`[wiki:build] skip ${file}: missing slug/title`);
      continue;
    }
    const slug = meta.slug;
    const category = meta.category || "tools";
    const tags = Array.isArray(meta.tags) ? meta.tags : [];
    const toolKey = meta.toolKey || null;

    articles.push({
      slug,
      title: meta.title,
      category,
      tags,
      toolKey,
      updatedAt: meta.updatedAt || null,
      description: body.split("\n")[0]?.replace(/^#+\s*/, "").slice(0, 120) || meta.title,
      markdown: body,
    });

    chunks.push(
      ...chunkByH2(slug, meta.title, category, tags, toolKey, body),
    );
  }

  articles.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
  const index = {
    version: 1,
    builtAt: new Date().toISOString(),
    categories: metaConfig.categories || [],
    articles,
    chunks,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(index, null, 0), "utf8");
  console.log(
    `[wiki:build] ${articles.length} articles, ${chunks.length} chunks → ${OUT_FILE}`,
  );
}

main();
