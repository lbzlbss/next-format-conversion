import { loadWikiIndex } from "./load-index.js";
import { detectIntent, categoriesForIntent } from "./intent.js";

const MIN_SCORE = 0.12;
const TOOL_KEY_BOOST = 0.35;

/** @param {string} text */
function tokenize(text) {
  const lower = text.toLowerCase();
  const tokens = lower.match(/[a-z0-9]+|[\u4e00-\u9fff]{1,}/g) || [];
  const bigrams = [];
  const cjk = lower.match(/[\u4e00-\u9fff]+/g) || [];
  for (const seg of cjk) {
    for (let i = 0; i < seg.length - 1; i++) {
      bigrams.push(seg.slice(i, i + 2));
    }
    if (seg.length === 1) bigrams.push(seg);
  }
  return [...tokens, ...bigrams];
}

/**
 * @param {string} query
 * @param {import('./load-index.js').WikiChunk} chunk
 */
function scoreChunk(query, queryTokens, chunk, toolKey) {
  const title = `${chunk.title} ${chunk.heading}`.toLowerCase();
  const tags = (chunk.tags || []).join(" ").toLowerCase();
  const body = chunk.content.toLowerCase();
  const q = query.toLowerCase();

  let score = 0;

  if (title.includes(q)) score += 3;
  if (tags.includes(q)) score += 2;
  if (body.includes(q)) score += 1.5;

  for (const t of queryTokens) {
    if (t.length < 2 && !/[\u4e00-\u9fff]/.test(t)) continue;
    if (title.includes(t)) score += 1.2;
    if (tags.includes(t)) score += 0.8;
    if (body.includes(t)) score += 0.5;
  }

  if (toolKey && chunk.toolKey === toolKey) {
    score += TOOL_KEY_BOOST;
  }

  const lenNorm = 1 / Math.sqrt(1 + chunk.content.length / 500);
  return score * lenNorm;
}

/**
 * @param {string} query
 * @param {{ limit?: number, toolKey?: string|null, useWiki?: boolean }} [options]
 */
export async function searchWiki(query, options = {}) {
  const { limit = 3, toolKey = null, useWiki = true } = options;
  const trimmed = query?.trim() || "";

  if (!useWiki || !trimmed) {
    return { chunks: [], intent: "chitchat" };
  }

  const intent = detectIntent(trimmed);
  if (intent === "chitchat") {
    return { chunks: [], intent };
  }

  const index = await loadWikiIndex();
  const allowedCategories = categoriesForIntent(intent);
  let pool = index.chunks || [];

  if (allowedCategories) {
    pool = pool.filter((c) => allowedCategories.includes(c.category));
  }

  const queryTokens = tokenize(trimmed);
  const scored = pool
    .map((chunk) => ({
      slug: chunk.slug,
      title: chunk.title,
      heading: chunk.heading,
      content: chunk.content,
      category: chunk.category,
      score: scoreChunk(trimmed, queryTokens, chunk, toolKey),
    }))
    .filter((c) => c.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score);

  const seen = new Set();
  const chunks = [];
  for (const item of scored) {
    const key = `${item.slug}::${item.heading}`;
    if (seen.has(key)) continue;
    seen.add(key);
    chunks.push(item);
    if (chunks.length >= limit) break;
  }

  return { chunks, intent };
}

/**
 * @param {Array<{ slug: string, title: string, heading?: string, content: string }>} chunks
 */
export function formatWikiContext(chunks) {
  if (!chunks?.length) return "";

  const body = chunks
    .map(
      (c, i) =>
        `[${i + 1}] ${c.title}${c.heading ? ` > ${c.heading}` : ""}\n${c.content}`,
    )
    .join("\n---\n");

  return `\n\n【参考资料】\n${body}\n\n请优先依据上述资料回答；若资料不足以回答，请明确说明，勿编造文档中未出现的内容。`;
}

/**
 * @param {Array<{ slug: string, title: string, heading?: string }>} chunks
 */
export function chunksToSources(chunks) {
  const seen = new Set();
  const items = [];
  for (const c of chunks) {
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    items.push({ slug: c.slug, title: c.title });
  }
  return items;
}
