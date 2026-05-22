#!/usr/bin/env node
/**
 * Phase 3 收尾: lint + build，输出测试报告
 */
import fs from "node:fs";
import path from "node:path";
import {
  copyTemplate,
  getRunDir,
  loadRun,
  saveRun,
  tryRunCmd,
  cliArgs,
  updatePhase,
} from "./lib/run-context.mjs";

const runId = cliArgs(process.argv.slice(2))[0];
if (!runId) {
  console.error("用法: pnpm agent:test -- <runId>");
  process.exit(1);
}

const state = loadRun(runId);
const runDir = getRunDir(runId);
const reportPath = path.join(runDir, "03-test-report.md");

const lint = tryRunCmd("pnpm lint", { silent: true });
const build = tryRunCmd("pnpm build", { silent: true });

const sections = [
  "## 自动化检查",
  "",
  "### ESLint",
  lint.ok ? "✅ 通过" : `❌ 失败\n\`\`\`\n${lint.error}\n\`\`\``,
  "",
  "### Production Build",
  build.ok ? "✅ 通过" : `❌ 失败\n\`\`\`\n${build.error}\n\`\`\``,
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
  status: lint.ok && build.ok ? "completed" : "needs-fix",
  lintOk: lint.ok,
  buildOk: build.ok,
  testReport: "03-test-report.md",
};
saveRun(state);
updatePhase(runId, "implement", state.phases.implement);

console.log(lint.ok && build.ok ? "\n✅ 测试报告已生成（检查通过）" : "\n⚠️ 测试报告已生成（存在失败项）");
console.log(`   ${reportPath}`);
console.log(`\n下一步: pnpm agent:git -- branch ${runId}`);
console.log(`         完成开发后: pnpm agent:git -- merge ${runId} --tag v0.x.x --confirm\n`);

process.exit(lint.ok && build.ok ? 0 : 1);
