import fs from "node:fs";
import path from "node:path";

const STYLES = `*{margin:0;padding:0;box-sizing:border-box}
body{background:#0f1117;color:#c9d1d9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Oxygen,sans-serif;padding:20px;line-height:1.6}
.container{max-width:900px;margin:0 auto}
h1{color:#58a6ff;font-size:1.5em;margin-bottom:4px}
h2{color:#e6edf3;font-size:1.15em;margin:24px 0 12px;padding-bottom:6px;border-bottom:1px solid #30363d}
.subtitle{color:#8b949e;font-size:0.85em;margin-bottom:20px}
.card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:16px;margin-bottom:16px}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
@media(max-width:600px){.grid-2,.grid-3{grid-template-columns:1fr}}
.score-card{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:14px;text-align:center}
.score-card .label{font-size:0.75em;color:#8b949e;text-transform:uppercase;letter-spacing:0.5px}
.score-card .value{font-size:1.5em;font-weight:700;margin:4px 0}
.badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:0.75em;font-weight:600}
.good{background:rgba(63,185,80,0.15);color:#3fb950;border:1px solid rgba(63,185,80,0.3)}
.warn{background:rgba(210,153,34,0.15);color:#d29922;border:1px solid rgba(210,153,34,0.3)}
.poor{background:rgba(248,81,73,0.15);color:#f85149;border:1px solid rgba(248,81,73,0.3)}
.info{background:rgba(88,166,255,0.15);color:#58a6ff;border:1px solid rgba(88,166,255,0.3)}
table{width:100%;border-collapse:collapse;font-size:0.85em}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #21262d}
th{color:#8b949e;font-weight:600;font-size:0.8em;text-transform:uppercase;letter-spacing:0.3px}
td{color:#c9d1d9}
.issue{padding:12px 14px;border-radius:6px;margin-bottom:10px;border-left:4px solid}
.issue.p0{background:rgba(248,81,73,0.08);border-color:#f85149}
.issue.p1{background:rgba(210,153,34,0.08);border-color:#d29922}
.issue.p2{background:rgba(88,166,255,0.08);border-color:#58a6ff}
.issue .tag{font-weight:700;margin-right:6px}
.issue p{margin:4px 0 0;color:#8b949e;font-size:0.85em}
.quick-win{background:rgba(63,185,80,0.08);border:1px solid rgba(63,185,80,0.25);border-radius:8px;padding:14px;margin-bottom:10px}
.quick-win h4{color:#3fb950;margin-bottom:4px}
.quick-win p{color:#8b949e;font-size:0.85em;margin:0}
.bar{height:8px;background:#21262d;border-radius:4px;overflow:hidden;margin-top:4px}
.bar-fill{height:100%;border-radius:4px}
.screenshot-container{text-align:center;margin:16px 0}
.screenshot-container img{max-width:100%;max-height:480px;border-radius:8px;border:1px solid #30363d}
.footer{text-align:center;color:#484f58;font-size:0.75em;margin-top:32px;padding-top:16px;border-top:1px solid #21262d}
code{background:#21262d;padding:1px 4px;border-radius:3px;font-size:0.9em}`;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scoreColor(score100) {
  if (score100 >= 90) return "#3fb950";
  if (score100 >= 50) return "#d29922";
  return "#f85149";
}

function scoreGrade(score100) {
  if (score100 >= 90) return "A";
  if (score100 >= 80) return "B+";
  if (score100 >= 70) return "B";
  if (score100 >= 60) return "C+";
  if (score100 >= 50) return "C";
  if (score100 >= 40) return "D";
  return "F";
}

function metricBadge(score) {
  if (score == null) return '<span class="badge info">—</span>';
  if (score >= 0.9) return '<span class="badge good">✅ Good</span>';
  if (score >= 0.5) return '<span class="badge warn">⚠️ Warn</span>';
  return '<span class="badge poor">❌ Poor</span>';
}

function formatMs(ms) {
  if (ms == null || Number.isNaN(ms)) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

function formatBytes(b) {
  if (b == null || Number.isNaN(b)) return "—";
  if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(2)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}

function auditMetric(lhr, id) {
  const a = lhr.audits?.[id];
  if (!a) return { title: id, value: null, score: null, display: "—" };
  return {
    title: a.title || id,
    value: a.numericValue ?? null,
    score: a.score,
    display: a.displayValue || formatMs(a.numericValue),
  };
}

function parseLighthouse(lhr) {
  const cats = lhr.categories || {};
  const scores = {
    performance: cats.performance?.score != null ? Math.round(cats.performance.score * 100) : null,
    accessibility: cats.accessibility?.score != null ? Math.round(cats.accessibility.score * 100) : null,
    bestPractices: cats["best-practices"]?.score != null ? Math.round(cats["best-practices"].score * 100) : null,
    seo: cats.seo?.score != null ? Math.round(cats.seo.score * 100) : null,
  };

  const coreIds = [
    ["first-contentful-paint", "< 1.8s"],
    ["largest-contentful-paint", "< 2.5s"],
    ["total-blocking-time", "< 200ms"],
    ["cumulative-layout-shift", "< 0.1"],
    ["speed-index", "< 3.4s"],
    ["interactive", "< 3.8s"],
  ];

  const coreMetrics = coreIds.map(([id, target]) => {
    const m = auditMetric(lhr, id);
    return { ...m, target };
  });

  const byteWeight = auditMetric(lhr, "total-byte-weight");
  const requests = auditMetric(lhr, "network-requests");
  const domSize = auditMetric(lhr, "dom-size");

  const resourceAudits = [
    "total-byte-weight",
    "unused-javascript",
    "unused-css-rules",
    "modern-image-formats",
    "uses-optimized-images",
  ];

  const failed = Object.values(lhr.audits || {})
    .filter((a) => a.score !== null && a.score < 0.9 && a.scoreDisplayMode !== "informative")
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
    .slice(0, 12);

  const passed = Object.values(lhr.audits || {})
    .filter((a) => a.score === 1 && a.scoreDisplayMode !== "informative")
    .slice(0, 14);

  const opportunities = Object.values(lhr.audits || {})
    .filter((a) => a.details?.type === "opportunity" && a.numericValue > 0)
    .sort((a, b) => (b.numericValue || 0) - (a.numericValue || 0))
    .slice(0, 8);

  let screenshotDataUri = null;
  const ss = lhr.audits?.["final-screenshot"];
  if (ss?.details?.data?.startsWith("data:image")) {
    screenshotDataUri = ss.details.data;
  }

  return {
    scores,
    coreMetrics,
    byteWeight,
    requests,
    domSize,
    failed,
    passed,
    opportunities,
    screenshotDataUri,
    fetchTime: lhr.fetchTime,
    finalUrl: lhr.finalUrl || lhr.requestedUrl,
  };
}

/**
 * @param {Object} opts
 * @param {import('node:fs').PathLike} opts.outputPath
 * @param {Object} opts.meta
 * @param {Object} opts.lhr - Lighthouse LHR JSON
 */
export function writePerformanceAuditHtml({ outputPath, meta, lhr }) {
  const d = parseLighthouse(lhr);
  const perf = d.scores.performance ?? 0;
  const grade = scoreGrade(perf);
  const gradeColor = scoreColor(perf);
  const generatedAt = new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });

  const scoreCards = [
    ["Grade", grade, gradeColor],
    ["Performance", d.scores.performance ?? "—", scoreColor(d.scores.performance ?? 0)],
    ["Accessibility", d.scores.accessibility ?? "—", scoreColor(d.scores.accessibility ?? 0)],
    ["Best Practices", d.scores.bestPractices ?? "—", scoreColor(d.scores.bestPractices ?? 0)],
    ["SEO", d.scores.seo ?? "—", scoreColor(d.scores.seo ?? 0)],
    ["Page Weight", d.byteWeight.display || formatBytes(d.byteWeight.value), scoreColor(70)],
  ];

  const scoreCardsHtml = scoreCards
    .map(
      ([label, value, color]) =>
        `<div class="score-card"><div class="label">${escapeHtml(label)}</div><div class="value" style="color:${color}">${escapeHtml(String(value))}</div></div>`,
    )
    .join("\n");

  const coreRows = d.coreMetrics
    .map(
      (m) =>
        `<tr><td>${escapeHtml(m.title)}</td><td><strong>${escapeHtml(m.display)}</strong></td><td>${metricBadge(m.score)}</td><td>${escapeHtml(m.target)}</td></tr>`,
    )
    .join("\n");

  const resourceCards = `
<div class="score-card"><div class="label">Total Weight</div><div class="value" style="color:#d29922">${escapeHtml(d.byteWeight.display || "—")}</div></div>
<div class="score-card"><div class="label">Network Requests</div><div class="value" style="color:#58a6ff">${escapeHtml(d.requests.display || "—")}</div></div>
<div class="score-card"><div class="label">DOM Elements</div><div class="value" style="color:#3fb950">${escapeHtml(d.domSize.display || "—")}</div></div>`;

  const issuesHtml = d.failed
    .map((a, i) => {
      const sev = a.score != null && a.score < 0.5 ? "p0" : "p1";
      const tag = a.score != null && a.score < 0.5 ? "P0" : "P1";
      const tagColor = a.score != null && a.score < 0.5 ? "#f85149" : "#d29922";
      return `<div class="issue ${sev}">
<span class="tag" style="color:${tagColor}">${tag}</span> <strong>${escapeHtml(a.title)}</strong>
<p>${escapeHtml(a.description || "")}${a.displayValue ? ` <em>(${escapeHtml(a.displayValue)})</em>` : ""}</p>
</div>`;
    })
    .join("\n") || '<p style="color:#8b949e">无严重失败项</p>';

  const positiveHtml = d.passed
    .map(
      (a) =>
        `<li style="padding:6px 0">✅ <strong>${escapeHtml(a.title)}</strong> — ${escapeHtml((a.description || "").slice(0, 120))}${(a.description || "").length > 120 ? "…" : ""}</li>`,
    )
    .join("\n");

  const recRows = d.opportunities
    .map((a, i) => {
      const pri = i < 2 ? "warn" : "info";
      const label = i < 2 ? "P1" : "P2";
      return `<tr><td><span class="badge ${pri}">${label}</span></td><td>${escapeHtml(a.title)}</td><td>${escapeHtml(a.displayValue || "—")}</td><td>中</td></tr>`;
    })
    .join("\n");

  const quickWins = d.opportunities.slice(0, 3).map((a, i) => `<div class="quick-win">
<h4>${i + 1}. ${escapeHtml(a.title)}</h4>
<p>${escapeHtml(a.description || "")}</p>
</div>`).join("\n");

  const screenshotBlock = d.screenshotDataUri
    ? `<div class="screenshot-container"><img src="${d.screenshotDataUri}" alt="page screenshot" /></div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Performance Audit — ${escapeHtml(meta.pageSlug)}</title>
<style>${STYLES}</style>
</head>
<body>
<div class="container">

<h1>🔍 Frontend Performance Audit</h1>
<div class="subtitle">
<strong>Page:</strong> ${escapeHtml(meta.pageLabel)} &nbsp;|&nbsp;
<strong>URL:</strong> <a href="${escapeHtml(meta.url)}" style="color:#58a6ff">${escapeHtml(meta.url)}</a> &nbsp;|&nbsp;
<strong>Mode:</strong> Lighthouse (CI) &nbsp;|&nbsp;
<strong>Time:</strong> ${escapeHtml(generatedAt)} &nbsp;|&nbsp;
<strong>Run:</strong> ${escapeHtml(meta.runId)} &nbsp;|&nbsp;
<strong>Stack:</strong> ${escapeHtml(meta.stack || "Next.js 16 + React 19")}
</div>

${screenshotBlock}

<h2>📊 Overall Assessment</h2>
<div class="grid-3">
${scoreCardsHtml}
</div>

<h2>⏱️ Core Web Vitals & Metrics</h2>
<div class="card">
<table>
<tr><th>Metric</th><th>Value</th><th>Status</th><th>Target</th></tr>
${coreRows}
</table>
</div>

<h2>📦 Resource Overview</h2>
<div class="card">
<div class="grid-3">
${resourceCards}
</div>
</div>

<h2>⚠️ Issues by Severity</h2>
<div class="card">
${issuesHtml}
</div>

<h2>✅ Positive Findings</h2>
<div class="card">
<ul style="list-style:none;padding:0">
${positiveHtml}
</ul>
</div>

<h2>🚀 Optimization Recommendations</h2>
<div class="card">
<table>
<tr><th>Priority</th><th>Action</th><th>Potential Savings</th><th>Effort</th></tr>
${recRows || '<tr><td colspan="4" style="color:#8b949e">暂无 Lighthouse opportunity 项</td></tr>'}
</table>
</div>

<h2>⚡ Quick Wins</h2>
${quickWins || '<p style="color:#8b949e">见上方 Recommendations</p>'}

<div class="footer">
Generated by <strong>MediaFlow Agent Pipeline</strong> &nbsp;|&nbsp;
Requirement: ${escapeHtml(meta.requirement)} &nbsp;|&nbsp;
Analysis: Lighthouse JSON
</div>

</div>
</body>
</html>`;

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, html, "utf8");
  return outputPath;
}

export function performanceReportFileName(slug, date = new Date()) {
  const stamp = date.toISOString().slice(0, 10).replace(/-/g, "");
  const safe = slug.replace(/[^\w\u4e00-\u9fa5-]+/gi, "-").slice(0, 48) || "page";
  return `performance-audit-${safe}-${stamp}.html`;
}
