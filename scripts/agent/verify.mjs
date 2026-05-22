#!/usr/bin/env node
/**
 * 验证 + 冒烟测试；失败时输出可自愈报告供 Agent 修复
 * Usage:
 *   pnpm agent:verify -- <runId>
 *   pnpm agent:verify -- <runId> --prod https://nextformat.aiblank.top/
 *   pnpm agent:verify -- <runId> --skip-build
 */
import fs from "node:fs";
import path from "node:path";
import {
  cliArgs,
  getRunDir,
  loadRun,
  saveRun,
  updatePhase,
} from "./lib/run-context.mjs";
import { formatVerifyMarkdown, runVerification } from "./lib/verify-runner.mjs";

const args = cliArgs(process.argv.slice(2));
const runId = args[0];
const flags = new Set(args.slice(1));

if (!runId) {
  console.error(`用法:
  pnpm agent:verify -- <runId> [--prod <url>] [--skip-build] [--full-lint]
`);
  process.exit(1);
}

const state = loadRun(runId);
const runDir = getRunDir(runId);

const prodIdx = args.indexOf("--prod");
const prodUrl =
  prodIdx >= 0 && args[prodIdx + 1] && !args[prodIdx + 1].startsWith("--")
    ? args[prodIdx + 1]
    : process.env.AGENT_PROD_URL || "https://nextformat.aiblank.top/";

const useProd = flags.has("--prod") || process.env.AGENT_VERIFY_PROD === "1";

console.log("\n🔬 Agent 验证与冒烟测试...\n");

const report = await runVerification({
  skipBuild: flags.has("--skip-build"),
  fullLint: flags.has("--full-lint"),
  prodUrl: useProd ? prodUrl : undefined,
});

const jsonPath = path.join(runDir, "04-verify-report.json");
const mdPath = path.join(runDir, "04-verify-report.md");

fs.writeFileSync(jsonPath, `${JSON.stringify({ ...report, at: new Date().toISOString() }, null, 2)}\n`);
fs.writeFileSync(
  mdPath,
  `# 验证报告 · ${runId}\n\n**需求**: ${state.requirement}\n\n${formatVerifyMarkdown(report)}\n`,
);

const attempt = (state.phases.verify?.attempt ?? 0) + 1;
state.phases.verify = {
  status: report.ok ? "completed" : "needs-fix",
  attempt,
  report: "04-verify-report.md",
  prodUrl: useProd ? prodUrl : null,
  summary: report.summary,
};
state.phase = "verify";
saveRun(state);
updatePhase(runId, "verify", state.phases.verify);

for (const c of report.checks) {
  const icon = c.ok ? "✅" : "❌";
  console.log(`  ${icon} ${c.name}${c.durationMs != null ? ` (${c.durationMs}ms)` : ""}`);
  if (!c.ok && c.error) {
    console.log(`      → ${c.error.split("\n")[0].slice(0, 120)}`);
  }
}

console.log(`\n${report.ok ? "✅ 验证通过" : "❌ 验证失败 — 请 Agent 根据报告修复后重试"}`);
console.log(`   ${mdPath}`);

if (!report.ok) {
  console.log(`\n修复后重跑: pnpm agent:verify -- ${runId}${useProd ? ` --prod ${prodUrl}` : ""}`);
  console.log(`或闭环:     pnpm agent:loop -- ${runId} --prod ${prodUrl}\n`);
  process.exit(1);
}

console.log(`\n下一步: pnpm agent:test -- ${runId}\n`);
