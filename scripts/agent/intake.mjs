#!/usr/bin/env node
/**
 * Phase 1: 一句话需求 → 结构化 Run + 需求文档
 * Usage: node scripts/agent/intake.mjs "一句话需求" [--figma URL]
 */
import { cliArgs, initRun, REPO_ROOT } from "./lib/run-context.mjs";

function parseArgs(argv) {
  const args = { requirement: "", figmaUrl: null };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--figma" && argv[i + 1]) {
      args.figmaUrl = argv[++i];
      continue;
    }
    rest.push(argv[i]);
  }
  args.requirement = rest.join(" ").trim();
  return args;
}

const { requirement, figmaUrl } = parseArgs(cliArgs(process.argv.slice(2)));

if (!requirement) {
  console.error("用法: pnpm agent:intake -- \"一句话需求\" [--figma <url>]");
  process.exit(1);
}

const state = initRun({ requirement, figmaUrl });

console.log("\n✅ Agent Run 已创建");
console.log(`   runId:    ${state.runId}`);
console.log(`   branch:   ${state.branch}`);
console.log(`   目录:     docs/agent/runs/${state.runId}/`);
console.log(`\n下一步（在 Cursor 中执行 /agent-pipeline 或按 Skill 阶段 2 继续）:`);
console.log(`   pnpm agent:design -- ${state.runId}`);
console.log(`\n工作区: ${REPO_ROOT}\n`);
