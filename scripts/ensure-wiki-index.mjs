#!/usr/bin/env node
/**
 * 仅在索引缺失或 content/wiki 有更新时重建，避免 dev 每次启动都写 public 触发 HMR 整页刷新
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const INDEX_FILE = path.join(ROOT, "data/wiki-index.json");
const WIKI_DIR = path.join(ROOT, "content/wiki");
const BUILD_SCRIPT = path.join(__dirname, "build-wiki-index.mjs");

function walkMdNewestMtime(dir, latest = 0) {
  if (!fs.existsSync(dir)) return latest;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      latest = walkMdNewestMtime(full, latest);
    } else if (name.endsWith(".md")) {
      latest = Math.max(latest, stat.mtimeMs);
    }
  }
  return latest;
}

function needsBuild() {
  if (!fs.existsSync(INDEX_FILE)) return true;
  const indexMtime = fs.statSync(INDEX_FILE).mtimeMs;
  const wikiMtime = walkMdNewestMtime(WIKI_DIR);
  return wikiMtime > indexMtime;
}

if (needsBuild()) {
  const result = spawnSync(process.execPath, [BUILD_SCRIPT], {
    stdio: "inherit",
    cwd: ROOT,
  });
  process.exit(result.status ?? 1);
}
