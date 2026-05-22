#!/usr/bin/env node
/**
 * Agent 全流程入口
 * Usage: pnpm agent:run -- "一句话需求" [--figma URL] [--phase N]
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cliArgs, initRun, REPO_ROOT } from "./lib/run-context.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function runScript(name, args) {
  const script = path.join(__dirname, name);
  const r = spawnSync("node", [script, ...args], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    encoding: "utf8",
  });
  return r.status ?? 1;
}

function parseArgs(argv) {
  const out = { requirement: "", figmaUrl: null, phase: "all" };
  const rest = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--figma" && argv[i + 1]) {
      out.figmaUrl = argv[++i];
      continue;
    }
    if (argv[i] === "--phase" && argv[i + 1]) {
      out.phase = argv[++i];
      continue;
    }
    rest.push(argv[i]);
  }
  out.requirement = rest.join(" ").trim();
  return out;
}

const { requirement, figmaUrl, phase } = parseArgs(cliArgs(process.argv.slice(2)));

if (!requirement && phase === "all") {
  console.log(`
MediaFlow Agent 全流程

  pnpm agent:run -- "一句话需求" [--figma <url>]

分阶段:
  pnpm agent:intake -- "需求"
  pnpm agent:design -- <runId>
  # → Cursor 实现代码 + Figma（阶段 3）
  pnpm agent:test -- <runId>
  pnpm agent:git -- branch <runId>
  pnpm agent:git -- merge <runId> --tag v0.1.0 --confirm
  pnpm agent:perf -- <runId> [vercelUrl]
  pnpm agent:archive -- <runId>

在 Cursor 中使用: /agent-pipeline
`);
  process.exit(0);
}

if (phase === "all") {
  if (!requirement) {
    console.error("请提供一句话需求");
    process.exit(1);
  }
  const state = initRun({ requirement, figmaUrl });
  console.log(`\n🚀 Run ${state.runId} 已启动\n`);
  let code = runScript("design-system.mjs", [state.runId]);
  if (code !== 0) process.exit(code);
  console.log("\n⏸  请在 Cursor 中由 Agent 完成阶段 3（代码 + 设计稿 + 测试备注）");
  console.log("   完成后执行:");
  console.log(`   pnpm agent:test -- ${state.runId}`);
  console.log(`   pnpm agent:git -- branch ${state.runId}`);
  process.exit(0);
}

console.error(`未知 --phase: ${phase}`);
process.exit(1);
