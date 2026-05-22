#!/usr/bin/env node
/**
 * 测试-修复闭环：反复验证直到通过或达到最大轮次
 * Agent 在每轮失败后应修改代码，本脚本只负责检测与提示
 *
 * Usage: pnpm agent:loop -- <runId> [--prod URL] [--max 5]
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cliArgs, loadRun, REPO_ROOT } from "./lib/run-context.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = cliArgs(process.argv.slice(2));
const runId = args[0];

if (!runId) {
  console.error("用法: pnpm agent:loop -- <runId> [--prod <url>] [--max 5]");
  process.exit(1);
}

const maxIdx = args.indexOf("--max");
const maxAttempts =
  maxIdx >= 0 && args[maxIdx + 1] ? Math.max(1, parseInt(args[maxIdx + 1], 10)) : 5;

const prodIdx = args.indexOf("--prod");
const prodArgs =
  prodIdx >= 0 && args[prodIdx + 1] && !args[prodIdx + 1].startsWith("--")
    ? ["--prod", args[prodIdx + 1]]
    : ["--prod", "https://nextformat.aiblank.top/"];

const state = loadRun(runId);
console.log(`\n🔄 测试-修复闭环 · Run ${runId}`);
console.log(`   需求: ${state.requirement}`);
console.log(`   最多 ${maxAttempts} 轮验证\n`);

for (let i = 1; i <= maxAttempts; i += 1) {
  console.log(`—— 第 ${i}/${maxAttempts} 轮 ——\n`);

  const r = spawnSync(
    "node",
    [path.join(__dirname, "verify.mjs"), runId, ...prodArgs],
    { cwd: REPO_ROOT, stdio: "inherit", encoding: "utf8" },
  );

  if (r.status === 0) {
    console.log(`\n✅ 闭环完成（第 ${i} 轮通过）\n`);
    process.exit(0);
  }

  if (i < maxAttempts) {
    console.log(`
⚠️  第 ${i} 轮未通过。请 Cursor Agent：
   1. 阅读 docs/agent/runs/${runId}/04-verify-report.md
   2. 根据错误与 hint 修改代码
   3. 保存后我会继续下一轮（或你手动再跑: pnpm agent:loop -- ${runId}）

⏸  等待修复…（本脚本不自动改代码，需 Agent 介入）
`);
    console.log("提示: 在同一对话中让 Agent 修复后，重新执行:");
    console.log(`      pnpm agent:loop -- ${runId} ${prodArgs.join(" ")}\n`);
    process.exit(1);
  }
}

console.log(`\n❌ 已达 ${maxAttempts} 轮仍未通过，请人工介入。\n`);
process.exit(1);
