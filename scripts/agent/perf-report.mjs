#!/usr/bin/env node
/**
 * Phase 5: Vercel 部署后性能 / 项目检测报告（Markdown + HTML）
 */
import fs from "node:fs";
import path from "node:path";
import {
  copyTemplate,
  getRunDir,
  loadRun,
  REPO_ROOT,
  saveRun,
  slugify,
  tryRunCmd,
  cliArgs,
  updatePhase,
} from "./lib/run-context.mjs";
import {
  performanceReportFileName,
  writePerformanceAuditHtml,
} from "./lib/perf-html-report.mjs";

const PERFORMANCE_REPORTS_DIR = path.join(REPO_ROOT, "docs/agent/performance-reports");

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
    buildStats = `.next 产物约 ${(bytes / 1024 / 1024).toFixed(2)} MB（含本地缓存，生产以 Vercel 为准）`;
  } else {
    buildStats = "build 成功，未找到 .next 目录统计";
  }
}

let vercelInfo = "未配置部署 URL";
const vercelLs = tryRunCmd("vercel ls --limit 3 2>/dev/null || npx vercel ls 2>/dev/null", {
  silent: true,
});
if (vercelLs.ok && vercelLs.output) {
  vercelInfo = `最近部署:\n\`\`\`\n${vercelLs.output.trim().split("\n").slice(0, 5).join("\n")}\n\`\`\``;
}

const targetUrl = deployUrl?.startsWith("http")
  ? deployUrl
  : deployUrl
    ? `https://${deployUrl}`
    : null;

let lighthouseMd = "跳过（未提供 HTTPS URL）";
let htmlReportRel = null;
let htmlReportAbs = null;

if (targetUrl) {
  const lhJsonPath = path.join(runDir, "lighthouse-report.json");
  const lh = tryRunCmd(
    `npx lighthouse "${targetUrl.replace(/"/g, '\\"')}" --only-categories=performance,accessibility,best-practices,seo --output=json --output-path="${lhJsonPath}" --quiet --chrome-flags="--headless --no-sandbox" 2>/dev/null`,
    { silent: true },
  );

  let lhr = null;
  if (lh.ok && fs.existsSync(lhJsonPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(lhJsonPath, "utf8"));
      lhr = raw.lhr || raw;
    } catch (e) {
      console.warn("[perf] Lighthouse JSON 解析失败:", e.message);
    }
  }

  if (lhr) {
    const cats = lhr.categories || {};
    lighthouseMd = ["performance", "accessibility", "best-practices", "seo"]
      .map((k) => {
        const score = cats[k]?.score;
        return `- **${k}**: ${score != null ? Math.round(score * 100) : "n/a"}`;
      })
      .join("\n");

    const pageSlug = slugify(state.slug || state.requirement);
    const htmlName = performanceReportFileName(pageSlug);
    htmlReportAbs = path.join(PERFORMANCE_REPORTS_DIR, htmlName);
    htmlReportRel = `docs/agent/performance-reports/${htmlName}`;

    writePerformanceAuditHtml({
      outputPath: htmlReportAbs,
      meta: {
        runId,
        requirement: state.requirement,
        pageSlug,
        pageLabel: state.requirement,
        url: lhr.finalUrl || targetUrl,
        stack: "Next.js 16 + React 19 + Ant Design 6",
      },
      lhr,
    });

    fs.copyFileSync(htmlReportAbs, path.join(runDir, htmlName));
    console.log(`   HTML 报告: ${htmlReportRel}`);
  } else {
    lighthouseMd = `Lighthouse 未成功（可手动: npx lighthouse ${targetUrl} --view）\n${lh.error?.slice(0, 400) || ""}`;
  }

  state.vercelDeploymentUrl = targetUrl;
}

const htmlSection = htmlReportRel
  ? [
      "## HTML 性能审计报告",
      "",
      `已按团队模板生成（参考 performance-audit 样式）：`,
      "",
      `- **文件**: [\`${htmlReportRel}\`](../../performance-reports/${path.basename(htmlReportRel)})`,
      `- **打开**: 在浏览器中直接打开上述 HTML 文件`,
      "",
    ].join("\n")
  : "";

const projectChecks = [
  "## 构建与体积",
  "",
  build.ok ? "✅ `pnpm build` 通过" : "❌ `pnpm build` 失败",
  "",
  buildStats,
  "",
  "## 正式环境",
  "",
  targetUrl ? `**域名**: [${targetUrl}](${targetUrl})` : "（无 URL）",
  "",
  vercelInfo,
  "",
  htmlSection,
  "## Lighthouse",
  "",
  lighthouseMd,
  "",
  "## 建议优化项",
  "",
  "详见 HTML 报告中的 **Issues / Recommendations / Quick Wins** 章节。",
  "",
  "- 首页工具组件 `dynamic()` 懒加载，降低 Performance 分数压力",
  "- 大图使用 `next/image`，字体 `display=swap`",
  "- `/api/chat/pdf` Node 运行时注意冷启动与字体体积",
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
  perfReportHtml: htmlReportRel,
  deploymentUrl: targetUrl,
};
saveRun(state);
updatePhase(runId, "deploy", state.phases.deploy);

console.log(`\n✅ Markdown: ${reportPath}`);
if (htmlReportAbs) {
  console.log(`✅ HTML:   ${htmlReportAbs}`);
}
console.log(`\n归档: pnpm agent:archive -- ${runId}\n`);
