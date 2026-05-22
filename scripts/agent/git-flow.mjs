#!/usr/bin/env node
/**
 * Phase 4: Git 功能分支 → 提交检查 → 合并主分支 → 打 tag
 */
import {
  gitCurrentBranch,
  gitDefaultBranch,
  loadRun,
  REPO_ROOT,
  saveRun,
  tryRunCmd,
  cliArgs,
  updatePhase,
} from "./lib/run-context.mjs";

const [action, runId, ...rest] = cliArgs(process.argv.slice(2));

function hasFlag(name) {
  return rest.includes(name);
}

function getArg(name) {
  const idx = rest.indexOf(name);
  return idx >= 0 ? rest[idx + 1] : null;
}

if (!action || !runId) {
  console.error(`用法:
  pnpm agent:git -- branch <runId>     # 从主分支创建功能分支
  pnpm agent:git -- check <runId>      # lint + build 预检
  pnpm agent:git -- merge <runId> --tag v1.0.0 --confirm   # 合并并打 tag（需 --confirm）
`);
  process.exit(1);
}

const state = loadRun(runId);
const defaultBranch = gitDefaultBranch();
const featureBranch = state.branch;

function fail(msg, code = 1) {
  console.error(`\n❌ ${msg}\n`);
  process.exit(code);
}

if (action === "branch") {
  const dirty = tryRunCmd("git status --porcelain", { silent: true });
  if (dirty.ok && dirty.output.trim()) {
    console.warn("⚠️ 工作区有未提交改动，仍将创建分支");
  }

  tryRunCmd(`git fetch origin ${defaultBranch} 2>/dev/null || true`, { silent: true });
  const checkout = tryRunCmd(`git checkout -b ${featureBranch} ${defaultBranch}`);
  if (!checkout.ok) {
    const exists = tryRunCmd(`git checkout ${featureBranch}`);
    if (!exists.ok) fail(`无法创建分支 ${featureBranch}: ${checkout.error}`);
    console.log(`已在分支 ${featureBranch}`);
  } else {
    console.log(`✅ 已创建并切换到 ${featureBranch}`);
  }

  state.phases.git = { status: "in-progress", branch: featureBranch };
  saveRun(state);
  updatePhase(runId, "git", state.phases.git);
  console.log(`\n完成开发后提交，再运行: pnpm agent:git -- check ${runId}\n`);
  process.exit(0);
}

if (action === "check") {
  const lint = tryRunCmd("pnpm lint", { silent: true });
  const build = tryRunCmd("pnpm build", { silent: true });
  if (!lint.ok) fail(`Lint 未通过:\n${lint.error}`);
  if (!build.ok) fail(`Build 未通过:\n${build.error}`);
  console.log("✅ 预检通过，可合并");
  process.exit(0);
}

if (action === "merge") {
  const tag = getArg("--tag");
  if (!tag) fail("合并必须指定 --tag，例如 --tag v1.2.0");
  if (!hasFlag("--confirm")) {
    fail("合并到主分支并打 tag 属于破坏性操作，请追加 --confirm 确认");
  }

  const current = gitCurrentBranch();
  if (current !== featureBranch) {
    const co = tryRunCmd(`git checkout ${featureBranch}`);
    if (!co.ok) fail(`请先切换到功能分支 ${featureBranch}`);
  }

  const check = tryRunCmd("pnpm lint", { silent: true });
  const build = tryRunCmd("pnpm build", { silent: true });
  if (!check.ok || !build.ok) fail("合并前检查未通过，请先修复");

  tryRunCmd(`git checkout ${defaultBranch}`);
  tryRunCmd(`git merge --no-ff ${featureBranch} -m "feat(agent): ${state.requirement} (${runId})"`);
  tryRunCmd(`git tag -a ${tag} -m "release: ${tag} — ${state.requirement}"`);

  state.phases.git = { status: "completed", mergedAt: new Date().toISOString(), tag };
  state.tag = tag;
  saveRun(state);
  updatePhase(runId, "git", state.phases.git);

  console.log(`\n✅ 已合并 ${featureBranch} → ${defaultBranch}，并打 tag ${tag}`);
  console.log("   如需推送: git push origin main --tags\n");
  process.exit(0);
}

fail(`未知 action: ${action}`);
