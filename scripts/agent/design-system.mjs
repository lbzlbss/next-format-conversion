#!/usr/bin/env node
/**
 * Phase 2: 触发 ui-ux-pro-max 设计系统分析，生成设计方案
 */
import fs from "node:fs";
import path from "node:path";
import {
  copyTemplate,
  getRunDir,
  loadRun,
  REPO_ROOT,
  saveRun,
  cliArgs,
  tryRunCmd,
  updatePhase,
} from "./lib/run-context.mjs";

const runId = cliArgs(process.argv.slice(2))[0];
if (!runId) {
  console.error("用法: pnpm agent:design -- <runId>");
  process.exit(1);
}

const state = loadRun(runId);
const runDir = getRunDir(runId);
const keywords = `${state.requirement} MediaFlow developer tool dashboard`;
const outFile = path.join(runDir, "02-design-spec.md");

const searchCmd = `python3 .cursor/skills/ui-ux-pro-max/scripts/search.py "${keywords.replace(/"/g, '\\"')}" --design-system --persist -p "MediaFlow" -f markdown --stack nextjs`;

console.log("\n📐 运行设计系统分析...\n");
const result = tryRunCmd(searchCmd, { cwd: REPO_ROOT });

let designBody = "";
if (result.ok) {
  designBody = result.output || "";
  fs.writeFileSync(outFile, designBody, "utf8");
} else {
  copyTemplate("design-spec.md", outFile, {
    RUN_ID: runId,
    REQUIREMENT: state.requirement,
    DESIGN_OUTPUT: `设计系统脚本执行失败，请 Agent 手动运行:\n\`\`\`bash\n${searchCmd}\n\`\`\`\n\n错误:\n${result.error}`,
  });
  designBody = fs.readFileSync(outFile, "utf8");
}

const analysisPath = path.join(runDir, "02-requirement-analysis.md");
copyTemplate("requirement-analysis.md", analysisPath, {
  RUN_ID: runId,
  REQUIREMENT: state.requirement,
  CREATED_AT: new Date().toISOString(),
  FIGMA_URL: state.figmaUrl || "（未提供 — 实现阶段用 Figma MCP）",
  DESIGN_REF: "02-design-spec.md",
});

state.phases.analyze = {
  status: "completed",
  designSpec: "02-design-spec.md",
  analysis: "02-requirement-analysis.md",
  searchOk: result.ok,
};
saveRun(state);
updatePhase(runId, "analyze", state.phases.analyze);

console.log("✅ 阶段 2 完成");
console.log(`   需求分析: ${analysisPath}`);
console.log(`   设计方案: ${outFile}`);
console.log("\n下一步: Cursor Agent 执行阶段 3（代码 + Figma + 测试）");
console.log(`   pnpm agent:test -- ${runId}\n`);
