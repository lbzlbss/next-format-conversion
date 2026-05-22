#!/usr/bin/env node
/**
 * Phase 5: Vercel 部署后性能 / 项目检测报告
 */
import fs from "node:fs";
import path from "node:path";
import {
  copyTemplate,
  getRunDir,
  loadRun,
  REPO_ROOT,
  saveRun,
  tryRunCmd,
  cliArgs,
  updatePhase,
} from "./lib/run-context.mjs";

const args = cliArgs(process.argv.slice(2));
const runId = args[0];
const deployUrl =
  args[1] || process.env.VERCEL_URL || process.env.AGENT_DEPLOY_URL || null;

if (!runId) {
  console.error("用法: pnpm agent:perf -- <runId> [deploymentUrl]");
  process.exit(1);
}

const state = loadRun(runId);
const runDir = getRunDir(runId);
const reportPath = path.join(runDir, "05-perf-report.md");

console.log("\n📊 生成绩效报告...\n");

const build = tryRunCmd("pnpm build", { silent: true });
let buildStats = "（build 未执行或失败）";
if (build.ok) {
  const nextDir = path.join(REPO_ROOT, ".next");
  if (fs.existsSync(nextDir)) {
    const statDir = (dir) => {
      let total = 0;
      const walk = (p) => {
        for (const ent of fs.readdirSync(p, { withFileTypes: true })) {
          const full = path.join(p, ent.name);
          if (ent.isDirectory()) walk(full);
          else total += fs.statSync(full).size;
        }
      };
      walk(dir);
      return total;
    };
    const bytes = statDir(nextDir);
    buildStats = `.next 产物约 ${(bytes / 1024 / 1024).toFixed(2)} MB`;
  } else {
    buildStats = "build 成功，未找到 .next 目录统计";
  }
}

let vercelInfo = "未配置部署 URL。合并后执行:\n`vercel --prod` 或推送触发 CI，再运行:\n`pnpm agent:perf -- <runId> https://your-app.vercel.app`";
const vercelLs = tryRunCmd("vercel ls --limit 3 2>/dev/null || npx vercel ls 2>/dev/null", {
  silent: true,
});
if (vercelLs.ok && vercelLs.output) {
  vercelInfo = `最近部署 (vercel ls):\n\`\`\`\n${vercelLs.output.trim()}\n\`\`\``;
}

let lighthouse = "跳过（未安装 lighthouse 或未提供 HTTPS URL）";
const targetUrl = deployUrl?.startsWith("http") ? deployUrl : deployUrl ? `https://${deployUrl}` : null;
if (targetUrl) {
  const lh = tryRunCmd(
    `npx lighthouse ${targetUrl} --only-categories=performance,accessibility,best-practices,seo --output=json --quiet --chrome-flags="--headless" 2>/dev/null`,
    { silent: true },
  );
  if (lh.ok) {
    try {
      const json = JSON.parse(lh.output);
      const cats = json.categories || {};
      lighthouse = ["performance", "accessibility", "best-practices", "seo"]
        .map((k) => {
          const score = cats[k]?.score;
          return `- **${k}**: ${score != null ? Math.round(score * 100) : "n/a"}`;
        })
        .join("\n");
    } catch {
      lighthouse = "Lighthouse 已运行但解析失败，请查看 CLI 输出";
    }
  } else {
    lighthouse = `Lighthouse 未运行（可手动: npx lighthouse ${targetUrl} --view）\n${lh.error?.slice(0, 500)}`;
  }
  state.vercelDeploymentUrl = targetUrl;
}

const projectChecks = [
  "## 构建与体积",
  "",
  build.ok ? "✅ `pnpm build` 通过" : "❌ `pnpm build` 失败",
  "",
  buildStats,
  "",
  "## Vercel 部署",
  "",
  vercelInfo,
  "",
  targetUrl ? `检测 URL: ${targetUrl}` : "（无线上 URL — 仅本地构建报告）",
  "",
  "## Lighthouse（可选）",
  "",
  lighthouse,
  "",
  "## 建议优化项（Agent 填写）",
  "",
  "- 检查 LCP 相关大图是否走 `next/image`",
  "- 确认 Ant Design 按需/树摇无冗余",
  "- API 路由冷启动与 ffmpeg 依赖体积",
  "",
].join("\n");

copyTemplate("perf-report.md", reportPath, {
  RUN_ID: runId,
  REQUIREMENT: state.requirement,
  GENERATED_AT: new Date().toISOString(),
  PROJECT_CHECKS: projectChecks,
});

state.phases.deploy = {
  status: build.ok ? "completed" : "partial",
  perfReport: "05-perf-report.md",
  deploymentUrl: targetUrl,
};
saveRun(state);
updatePhase(runId, "deploy", state.phases.deploy);

console.log(`✅ 性能报告: ${reportPath}`);
console.log(`\n归档: pnpm agent:archive -- ${runId}\n`);
