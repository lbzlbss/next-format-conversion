import { generateChatPdfBuffer } from "../../../src/app/api/chat/pdf/_lib/generate-chat-pdf.js";

/**
 * @typedef {{ id: string, name: string, ok: boolean, error?: string, hint?: string, durationMs?: number }} SmokeResult
 */

/**
 * @param {SmokeResult} r
 */
function result(r) {
  return r;
}

/**
 * 本地 PDF 生成（不依赖 HTTP / pdfkit AFM）
 * @returns {Promise<SmokeResult>}
 */
export async function testPdfGenerationLocal() {
  const start = Date.now();
  try {
    const buffer = await generateChatPdfBuffer({
      title: "Agent Smoke Test",
      messages: [
        { role: "user", content: "冒烟测试用户消息" },
        { role: "assistant", content: "冒烟测试助手回复。\n含换行与中文。" },
      ],
      includeThinking: false,
    });

    if (!Buffer.isBuffer(buffer) || buffer.length < 500) {
      return result({
        id: "pdf-local",
        name: "PDF 本地生成",
        ok: false,
        error: `PDF 体积异常: ${buffer?.length ?? 0} bytes`,
        hint: "检查 generate-chat-pdf.js 与 public/fonts 字体加载",
        durationMs: Date.now() - start,
      });
    }

    const header = buffer.subarray(0, 5).toString("ascii");
    if (!header.startsWith("%PDF")) {
      return result({
        id: "pdf-local",
        name: "PDF 本地生成",
        ok: false,
        error: `无效 PDF 头: ${header}`,
        hint: "pdf-lib save() 输出应含 %PDF",
        durationMs: Date.now() - start,
      });
    }

    return result({
      id: "pdf-local",
      name: "PDF 本地生成",
      ok: true,
      durationMs: Date.now() - start,
    });
  } catch (e) {
    return result({
      id: "pdf-local",
      name: "PDF 本地生成",
      ok: false,
      error: e?.message || String(e),
      hint: "常见: 字体缺失 → pnpm chat-pdf:font；pdf-lib 未安装 → pnpm add pdf-lib @pdf-lib/fontkit",
      durationMs: Date.now() - start,
    });
  }
}

/**
 * @param {string} baseUrl
 * @returns {Promise<SmokeResult>}
 */
export async function testPdfApiRemote(baseUrl) {
  const start = Date.now();
  const url = `${baseUrl.replace(/\/$/, "")}/api/chat/pdf`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Remote Smoke",
        messages: [{ role: "assistant", content: "线上 PDF API 冒烟测试" }],
      }),
      signal: AbortSignal.timeout(90000),
    });

    if (!res.ok) {
      const errBody = await res.text();
      let msg = errBody.slice(0, 500);
      try {
        const j = JSON.parse(errBody);
        msg = j.error || msg;
      } catch {
        /* ignore */
      }
      return result({
        id: "pdf-api-remote",
        name: `PDF API ${url}`,
        ok: false,
        error: `HTTP ${res.status}: ${msg}`,
        hint: parsePdfApiHint(msg),
        durationMs: Date.now() - start,
      });
    }

    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/pdf")) {
      const preview = (await res.text()).slice(0, 200);
      return result({
        id: "pdf-api-remote",
        name: `PDF API ${url}`,
        ok: false,
        error: `Content-Type 非 PDF: ${ct} — ${preview}`,
        hint: "检查 route.js 返回头与 generateChatPdfBuffer",
        durationMs: Date.now() - start,
      });
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 500 || !buf.subarray(0, 5).toString("ascii").startsWith("%PDF")) {
      return result({
        id: "pdf-api-remote",
        name: `PDF API ${url}`,
        ok: false,
        error: "响应体不是有效 PDF",
        hint: "Vercel 上确认 pdf-lib 在 serverExternalPackages",
        durationMs: Date.now() - start,
      });
    }

    return result({
      id: "pdf-api-remote",
      name: `PDF API ${url}`,
      ok: true,
      durationMs: Date.now() - start,
    });
  } catch (e) {
    return result({
      id: "pdf-api-remote",
      name: `PDF API ${url}`,
      ok: false,
      error: e?.message || String(e),
      hint: "网络超时或域名不可达；确认已部署且 /api/chat/pdf 存在",
      durationMs: Date.now() - start,
    });
  }
}

/**
 * @param {string} baseUrl
 * @returns {Promise<SmokeResult>}
 */
export async function testPageReachable(baseUrl, path = "/chat") {
  const start = Date.now();
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });
    if (res.status >= 500) {
      return result({
        id: `page-${path}`,
        name: `页面 ${path}`,
        ok: false,
        error: `HTTP ${res.status}`,
        hint: "检查 Vercel 部署日志与 Next 构建",
        durationMs: Date.now() - start,
      });
    }
    return result({
      id: `page-${path}`,
      name: `页面 ${path}`,
      ok: res.ok,
      error: res.ok ? undefined : `HTTP ${res.status}`,
      hint: res.ok ? undefined : "页面不可访问",
      durationMs: Date.now() - start,
    });
  } catch (e) {
    return result({
      id: `page-${path}`,
      name: `页面 ${path}`,
      ok: false,
      error: e?.message || String(e),
      durationMs: Date.now() - start,
    });
  }
}

/**
 * @param {string} msg
 */
function parsePdfApiHint(msg) {
  if (/ENOENT|Helvetica|\.afm/i.test(msg)) {
    return "已弃用 pdfkit：改用 pdf-lib，并重新部署；确认 package.json 无 pdfkit";
  }
  if (/字体|font/i.test(msg)) {
    return "运行 pnpm chat-pdf:font 或在 Vercel 构建日志确认 ensure-chat-pdf-font";
  }
  if (/pdf-lib|fontkit/i.test(msg)) {
    return "确认 next.config serverExternalPackages 含 pdf-lib、@pdf-lib/fontkit";
  }
  return "阅读 src/app/api/chat/pdf 与 _lib/generate-chat-pdf.js";
}

/**
 * @param {Object} opts
 * @param {string} [opts.prodUrl]
 * @returns {Promise<SmokeResult[]>}
 */
export async function runAllSmokeTests({ prodUrl } = {}) {
  const results = [await testPdfGenerationLocal()];

  if (prodUrl) {
    results.push(await testPageReachable(prodUrl, "/chat"));
    results.push(await testPdfApiRemote(prodUrl));
  }

  return results;
}
