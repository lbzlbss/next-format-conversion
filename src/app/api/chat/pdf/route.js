import { NextResponse } from "next/server";
import { generateChatPdfBuffer } from "./_lib/generate-chat-pdf.js";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_MESSAGES = 80;
const MAX_CONTENT_LEN = 120_000;

/**
 * POST /api/chat/pdf
 * Body: { title?, messages: [{ role, content, thinking?, sources?, surfaces?, toolCalls? }], includeThinking?, filename? }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { title, messages, includeThinking, filename } = body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages 不能为空" }, { status: 400 });
    }

    if (messages.length > MAX_MESSAGES) {
      return NextResponse.json(
        { error: `消息条数不能超过 ${MAX_MESSAGES}` },
        { status: 400 },
      );
    }

    const totalLen = messages.reduce(
      (n, m) => n + String(m?.content || "").length + String(m?.thinking || "").length,
      0,
    );
    if (totalLen > MAX_CONTENT_LEN) {
      return NextResponse.json({ error: "内容过长，请减少导出范围" }, { status: 400 });
    }

    const normalized = messages
      .filter((m) => m && typeof m.content === "string" && m.content.trim())
      .map((m) => ({
        role: m.role === "user" || m.role === "assistant" ? m.role : "assistant",
        content: m.content.trim(),
        thinking: typeof m.thinking === "string" ? m.thinking : undefined,
        sources: Array.isArray(m.sources) ? m.sources : undefined,
        surfaces: Array.isArray(m.surfaces) ? m.surfaces : undefined,
        toolCalls: Array.isArray(m.toolCalls) ? m.toolCalls : undefined,
      }));

    if (normalized.length === 0) {
      return NextResponse.json({ error: "没有可导出的消息内容" }, { status: 400 });
    }

    const pdfTitle = title?.trim() || "MediaFlow AI 对话记录";
    const buffer = await generateChatPdfBuffer({
      title: pdfTitle,
      messages: normalized,
      includeThinking: includeThinking !== false,
    });

    const safeName =
      (filename || `mediaflow-chat-${Date.now()}`)
        .replace(/[^\w\u4e00-\u9fa5.-]+/g, "_")
        .slice(0, 80) || "mediaflow-chat";

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(safeName)}.pdf"`,
        "Content-Length": String(buffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[chat/pdf]", error);
    return NextResponse.json(
      { error: error?.message || "PDF 生成失败" },
      { status: 500 },
    );
  }
}
