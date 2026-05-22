#!/usr/bin/env node
/**
 * 需求归档：汇总 Run 产物到 docs/agent/archive/
 */
import fs from "node:fs";
import path from "node:path";
import {
  AGENT_ROOT,
  copyTemplate,
  getRunDir,
  loadRun,
  cliArgs,
  saveRun,
} from "./lib/run-context.mjs";

const runId = cliArgs(process.argv.slice(2))[0];
if (!runId) {
  console.error("用法: pnpm agent:archive -- <runId>");
  process.exit(1);
}

const state = loadRun(runId);
const runDir = getRunDir(runId);
const archiveDir = path.join(AGENT_ROOT, "archive", runId);
fs.mkdirSync(archiveDir, { recursive: true });

const files = fs.readdirSync(runDir).filter(
  (f) =>
    f.endsWith(".md") ||
    f.endsWith(".html") ||
    f.endsWith(".json") ||
    f === "state.json" ||
    f === "lighthouse-report.json",
);
for (const file of files) {
  fs.copyFileSync(path.join(runDir, file), path.join(archiveDir, file));
}

const indexPath = path.join(archiveDir, "INDEX.md");
copyTemplate("archive-index.md", indexPath, {
  RUN_ID: runId,
  REQUIREMENT: state.requirement,
  ARCHIVED_AT: new Date().toISOString(),
  BRANCH: state.branch,
  TAG: state.tag || "（未打 tag）",
  DEPLOY_URL: state.vercelDeploymentUrl || "（无）",
});

state.archivedAt = new Date().toISOString();
state.archivePath = `docs/agent/archive/${runId}`;
saveRun(state);

console.log(`\n✅ 已归档至 ${archiveDir}`);
console.log(`   索引: ${indexPath}\n`);
