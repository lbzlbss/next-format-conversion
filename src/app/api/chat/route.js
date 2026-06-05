import { NextResponse } from "next/server";
import {
  ARK_CHAT_URL,
  ARK_CHAT_MODEL,
  getChatApiKey,
} from "../_lib/ark.js";
import {
  searchWiki,
  formatWikiContext,
  chunksToSources,
} from "../_lib/wiki/search.js";
import {
  buildRetrievalQuery,
  inferWikiToolKey,
} from "../_lib/wiki/query-utils.js";
import { loadSystemPrompt } from "./_lib/load-system-prompt.js";
import { fetchLlmSurfaces } from "./_lib/fetch-llm-surfaces.js";
import { getSession } from "../_lib/auth/session.js";
import { consumeQuota } from "../_lib/quota/index.js";
import { ApiError, toErrorResponse } from "../_lib/guard.js";

function sseEncode(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * AI 对话助手 API（SSE 流式 + Wiki RAG）
 * 请求体: { messages, context?: { toolKey?, useWiki? } }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { messages, context } = body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "messages 不能为空" }, { status: 400 });
    }

    const lastUser = messages.filter((m) => m.role === "user").pop();
    const userContent = lastUser?.content?.trim();
    if (!userContent) {
      return NextResponse.json(
        { error: "最后一条用户消息不能为空" },
        { status: 400 },
      );
    }

    const session = await getSession();
    try {
      await consumeQuota(request, "chat", session ?? {});
    } catch (quotaErr) {
      if (quotaErr instanceof ApiError) {
        return toErrorResponse(quotaErr);
      }
      throw quotaErr;
    }

    const apiKey = getChatApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "ARK_API_KEY2 未设置，请在 .env 中配置" },
        { status: 500 },
      );
    }

    const useWiki = context?.useWiki !== false;
    const retrievalQuery = buildRetrievalQuery(messages) || userContent;
    const toolKey =
      context?.toolKey || inferWikiToolKey(retrievalQuery) || null;
    const { chunks: wikiChunks } = await searchWiki(retrievalQuery, {
      limit: 3,
      toolKey,
      useWiki,
      messages,
    });

    const wikiBlock = formatWikiContext(wikiChunks);
    const sources = chunksToSources(wikiChunks);
    const systemPrompt = loadSystemPrompt() + wikiBlock;

    const arkMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    const arkRes = await fetch(ARK_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: ARK_CHAT_MODEL,
        messages: arkMessages,
        stream: true,
      }),
    });

    if (!arkRes.ok) {
      const errText = await arkRes.text();
      console.error("[chat] Ark error:", arkRes.status, errText);
      return NextResponse.json(
        {
          error: `Ark 接口错误: ${arkRes.status}${
            errText ? ` ${errText.slice(0, 200)}` : ""
          }`,
        },
        { status: arkRes.status >= 500 ? 502 : arkRes.status },
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let closed = false;
        const close = () => {
          if (!closed) {
            closed = true;
            controller.close();
          }
        };
        const push = (event, data) => {
          if (!closed) {
            controller.enqueue(encoder.encode(sseEncode(event, data)));
          }
        };

        if (sources.length > 0) {
          push("sources", { items: sources });
        }

        try {
          const llmSurfaces = await fetchLlmSurfaces(userContent, { toolKey });
          for (const surface of llmSurfaces) {
            push("a2ui", { surface });
          }
        } catch (e) {
          console.error("[chat] a2ui llm surfaces", e);
        }

        const reader = arkRes.body?.getReader();
        if (!reader) {
          push("error", { error: "无响应体" });
          close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(":")) continue;
              if (!trimmed.startsWith("data: ")) continue;

              const data = trimmed.slice(6);
              if (data === "[DONE]") {
                push("done", {});
                close();
                return;
              }

              try {
                const obj = JSON.parse(data);
                const delta = obj?.choices?.[0]?.delta ?? obj?.delta ?? {};
                const reasoning =
                  delta.reasoning_content ?? delta.reasoning ?? null;
                const content = delta.content ?? null;

                if (typeof reasoning === "string" && reasoning.length > 0) {
                  push("thinking", { content: reasoning });
                }
                if (typeof content === "string" && content.length > 0) {
                  push("content", { content });
                }
              } catch {
                // 忽略单行解析失败
              }
            }
          }
          push("done", {});
        } catch (e) {
          console.error("[chat] stream read error", e);
          push("error", { error: "流读取异常" });
        } finally {
          close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[chat]", error);
    return NextResponse.json(
      { error: "对话处理失败，请稍后重试" },
      { status: 500 },
    );
  }
}
