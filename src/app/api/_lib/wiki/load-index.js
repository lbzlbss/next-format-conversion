import fs from "fs";
import path from "path";

/** @type {{ version: number, builtAt: string, categories: unknown[], articles: WikiArticle[], chunks: WikiChunk[] } | null} */
let cachedIndex = null;
let cachedMtime = 0;

/**
 * @typedef {Object} WikiArticle
 * @property {string} slug
 * @property {string} title
 * @property {string} category
 * @property {string[]} tags
 * @property {string|null} toolKey
 * @property {string|null} updatedAt
 * @property {string} description
 * @property {string} markdown
 */

/**
 * @typedef {Object} WikiChunk
 * @property {string} id
 * @property {string} slug
 * @property {string} title
 * @property {string} heading
 * @property {string} category
 * @property {string[]} tags
 * @property {string|null} toolKey
 * @property {string} content
 */

export function getWikiIndexPath() {
  return path.join(process.cwd(), "data/wiki-index.json");
}

export async function loadWikiIndex() {
  const indexPath = getWikiIndexPath();
  if (!fs.existsSync(indexPath)) {
    return {
      version: 0,
      builtAt: null,
      categories: [],
      articles: [],
      chunks: [],
    };
  }

  const stat = fs.statSync(indexPath);
  if (cachedIndex && stat.mtimeMs === cachedMtime) {
    return cachedIndex;
  }

  const raw = fs.readFileSync(indexPath, "utf8");
  cachedIndex = JSON.parse(raw);
  cachedMtime = stat.mtimeMs;
  return cachedIndex;
}

export function getArticleBySlug(index, slug) {
  return index.articles?.find((a) => a.slug === slug) ?? null;
}
