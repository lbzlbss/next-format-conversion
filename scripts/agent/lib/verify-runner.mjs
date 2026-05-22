import { tryRunCmd } from "./run-context.mjs";
import { runAllSmokeTests } from "./smoke-tests.mjs";

/**
 * @typedef {{ id: string, name: string, ok: boolean, error?: string, hint?: string, durationMs?: number }} CheckResult
 */

/**
 * @param {Object} opts
 * @param {boolean} [opts.skipBuild]
 * @param {boolean} [opts.fullLint]
 * @param {string} [opts.prodUrl]
 */
export async function runVerification({ skipBuild = false, fullLint = false, prodUrl } = {}) {
  /** @type {CheckResult[]} */
  const checks = [];

  const lintCmd = fullLint
    ? "pnpm lint"
    : 'pnpm exec eslint "src/app/api/chat/**/*.{js,jsx}" "src/app/components/chat/**/*.{js,jsx}" "src/app/lib/chat-pdf-client.js" --max-warnings 0';
  const lint = tryRunCmd(lintCmd, { silent: true });
  checks.push({
    id: "lint",
    name: fullLint ? "ESLint (全仓)" : "ESLint (对话/PDF 范围)",
    ok: lint.ok,
    error: lint.ok ? undefined : lint.error?.slice(0, 2000),
    hint: lint.ok ? undefined : "修复上述文件 lint；全仓检查用 --full-lint",
  });

  if (!skipBuild) {
    const build = tryRunCmd("pnpm build", { silent: true });
    checks.push({
      id: "build",
      name: "Production Build",
      ok: build.ok,
      error: build.ok ? undefined : build.error?.slice(0, 3000),
      hint: build.ok ? undefined : "根据构建日志修复 TS/导入/Next 配置",
    });
  }

  const smoke = await runAllSmokeTests({ prodUrl });
  checks.push(...smoke);

  const failed = checks.filter((c) => !c.ok);
  return {
    ok: failed.length === 0,
    checks,
    failed,
    summary: {
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
    },
  };
}

/**
 * @param {ReturnType<typeof runVerification> extends Promise<infer T> ? T : never>} report
 */
export function formatVerifyMarkdown(report) {
  const lines = [
    "## 验证摘要",
    "",
    report.ok ? "✅ **全部通过**" : `❌ **${report.failed.length} 项失败**（${report.summary.passed}/${report.summary.total} 通过）`,
    "",
    "| 检查项 | 结果 | 耗时 |",
    "|--------|------|------|",
  ];

  for (const c of report.checks) {
    const status = c.ok ? "✅" : "❌";
    const ms = c.durationMs != null ? `${c.durationMs}ms` : "—";
    lines.push(`| ${c.name} | ${status} | ${ms} |`);
  }

  if (report.failed.length > 0) {
    lines.push("", "## 失败详情与修复提示", "");
    for (const f of report.failed) {
      lines.push(`### ${f.name}`, "");
      lines.push("```", f.error || "未知错误", "```", "");
      if (f.hint) lines.push(`**修复方向**: ${f.hint}`, "");
    }
    lines.push(
      "## Agent 自愈指令",
      "",
      "1. 根据上方错误修改代码（优先相关 API/组件）",
      "2. 重新运行: `pnpm agent:verify -- <runId>`",
      "3. 直至全部通过后再合并 / 打 tag",
      "",
    );
  }

  return lines.join("\n");
}
