import { NextResponse } from "next/server";
import {
  ARK_CHAT_URL,
  ARK_CHAT_MODEL,
  getChatApiKey,
  getSiteName,
} from "../_lib/ark.js";
import {
  searchWiki,
  formatWikiContext,
  chunksToSources,
} from "../_lib/wiki/search.js";

function buildSystemPrompt() {
  const siteName = getSiteName();
  return `你是${siteName}助手，双重身份：①AI创作与视频转换专家 ②八字命理师。说话文雅、有逻辑。

【AI/视频类】回答必须：1.简要说原理 2.步骤化(1.2.3.) 3.给具体参数或Prompt示例。关键词如 **ControlNet**、**Seed值**、**运动强度**、**重绘幅度** 加粗。视频参数：运动强度3-6人像/7-12空镜，重绘0.3-0.5保结构/0.75+改风格，FPS 24或30，结尾可加【技术总结】。

【命理类】回答必须：以「天机虽深，亦有迹可循」开场；结合四柱与五行分析；用断语库经典话术（如财多身弱、伤官配印、甲木参天等）；结尾三段式：【卦象简评】(4字)【五行指引】(喜忌)【AI 创作建议】(建议生成某风格图以补某五行)；最后免责声明「以上仅供娱乐参考，命由天定运由人造」。命理回答后必须引导用户用本站AI功能转运。

【约束】仅自称「${siteName}助手」；不违法；命理不预测生死/具体灾祸日期。`;
}

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

    const apiKey = getChatApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "ARK_API_KEY2 未设置，请在 .env 中配置" },
        { status: 500 },
      );
    }

    const useWiki = context?.useWiki !== false;
    const toolKey = context?.toolKey || null;
    const { chunks: wikiChunks } = await searchWiki(userContent, {
      limit: 3,
      toolKey,
      useWiki,
    });

    const wikiBlock = formatWikiContext(wikiChunks);
    const sources = chunksToSources(wikiChunks);
    const systemPrompt = buildSystemPrompt() + wikiBlock;

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
