#!/usr/bin/env node
/**
 * Phase 3 收尾: lint + build，输出测试报告
 */
import fs from "node:fs";
import path from "node:path";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  copyTemplate,
  getRunDir,
  loadRun,
  REPO_ROOT,
  saveRun,
  cliArgs,
  updatePhase,
} from "./lib/run-context.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const runId = cliArgs(process.argv.slice(2))[0];
if (!runId) {
  console.error("用法: pnpm agent:test -- <runId> [--prod <url>]");
  process.exit(1);
}

const state = loadRun(runId);
const runDir = getRunDir(runId);
const reportPath = path.join(runDir, "03-test-report.md");

const prodIdx = process.argv.indexOf("--prod");
const verifyArgs = [path.join(__dirname, "verify.mjs"), runId];
if (prodIdx >= 0 && process.argv[prodIdx + 1]) {
  verifyArgs.push("--prod", process.argv[prodIdx + 1]);
}

const verifyRun = spawnSync("node", verifyArgs, {
  cwd: REPO_ROOT,
  encoding: "utf8",
});
const verifyOk = verifyRun.status === 0;
const verifyMd = path.join(runDir, "04-verify-report.md");
const verifySection = fs.existsSync(verifyMd)
  ? fs.readFileSync(verifyMd, "utf8")
  : "（未生成 verify 报告）";

const sections = [
  "## 自动化检查（含 verify 闭环）",
  "",
  verifyOk ? "✅ `pnpm agent:verify` 全部通过" : "❌ `pnpm agent:verify` 存在失败项",
  "",
  verifySection,
  "",
  "## 人工验收清单",
  "",
  "- [ ] 功能符合 `01-requirement.md` 验收标准",
  "- [ ] UI 对齐 `design.md` / `02-design-spec.md`",
  "- [ ] Figma 同步清单已完成（如有设计稿）",
  "- [ ] 无控制台报错、无布局错位",
  "- [ ] 移动端/侧栏布局正常",
  "",
  "## Agent 实现备注",
  "",
  "（由 Cursor Agent 在实现完成后补充：改动文件列表、关键决策、已知限制）",
  "",
].join("\n");

copyTemplate("test-report.md", reportPath, {
  RUN_ID: runId,
  REQUIREMENT: state.requirement,
  GENERATED_AT: new Date().toISOString(),
  AUTO_RESULTS: sections,
});

state.phases.implement = {
  status: verifyOk ? "completed" : "needs-fix",
  verifyOk,
  testReport: "03-test-report.md",
  verifyReport: "04-verify-report.md",
};
saveRun(state);
updatePhase(runId, "implement", state.phases.implement);

console.log(verifyOk ? "\n✅ 测试报告已生成（验证通过）" : "\n⚠️ 测试报告已生成（请按 04-verify-report 修复）");
console.log(`   ${reportPath}`);
if (!verifyOk) {
  console.log(`\n修复闭环: pnpm agent:loop -- ${runId} --prod https://nextformat.aiblank.top/\n`);
}
console.log(`\n下一步: pnpm agent:git -- check ${runId}\n`);

process.exit(verifyOk ? 0 : 1);
