import { NextResponse } from "next/server";

const ARK_CHAT_URL =
  "https://ark.cn-beijing.volces.com/api/v3/chat/completions";
const ARK_MODEL = "doubao-seed-2-0-lite-260215";

/**
 * 精简 System Prompt，降低每轮请求的 token 消耗（完整规范见 skill.md）
 * 仅保留：身份、输出格式、约束、关键参数要点；去掉冗长示例与重复描述。
 * 若需更强一致性可改用完整 prompt，或接入「按意图注入片段」策略。
 */
function buildSystemPrompt() {
  const siteName = process.env.SITE_NAME || "MediaFlow";
  return `你是${siteName}助手，双重身份：①AI创作与视频转换专家 ②八字命理师。说话文雅、有逻辑。

【AI/视频类】回答必须：1.简要说原理 2.步骤化(1.2.3.) 3.给具体参数或Prompt示例。关键词如 **ControlNet**、**Seed值**、**运动强度**、**重绘幅度** 加粗。视频参数：运动强度3-6人像/7-12空镜，重绘0.3-0.5保结构/0.75+改风格，FPS 24或30，结尾可加【技术总结】。

【命理类】回答必须：以「天机虽深，亦有迹可循」开场；结合四柱与五行分析；用断语库经典话术（如财多身弱、伤官配印、甲木参天等）；结尾三段式：【卦象简评】(4字)【五行指引】(喜忌)【AI 创作建议】(建议生成某风格图以补某五行)；最后免责声明「以上仅供娱乐参考，命由天定运由人造」。命理回答后必须引导用户用本站AI功能转运。

【约束】仅自称「${siteName}助手」；不违法；命理不预测生死/具体灾祸日期。`;
}

/**
 * AI 对话助手 API（流式）
 * 请求体: { messages: [{ role: 'user' | 'assistant', content: string }] }
 * 返回: NDJSON 流 { "content": "..." } 与 { "done": true }
 * System Prompt 符合 skill.md「网站全能助手 + 命理大师 + 视频转换专家」规范
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { messages } = body || {};

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

    const apiKey = process.env.ARK_API_KEY2;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ARK_API_KEY2 未设置，请在 .env 中配置" },
        { status: 500 },
      );
    }

    const systemPrompt = buildSystemPrompt();
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
        model: ARK_MODEL,
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
        const reader = arkRes.body?.getReader();
        if (!reader) {
          controller.enqueue(
            encoder.encode(JSON.stringify({ error: "无响应体" }) + "\n"),
          );
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
              if (trimmed.startsWith("data: ")) {
                const data = trimmed.slice(6);
                if (data === "[DONE]") {
                  controller.enqueue(
                    encoder.encode(JSON.stringify({ done: true }) + "\n"),
                  );
                  close();
                  return;
                }
                try {
                  const obj = JSON.parse(data);
                  const content =
                    obj?.choices?.[0]?.delta?.content ?? obj?.delta?.content;
                  if (typeof content === "string" && content.length > 0) {
                    controller.enqueue(
                      encoder.encode(JSON.stringify({ content }) + "\n"),
                    );
                  }
                } catch (_) {
                  // 忽略单行解析失败
                }
              }
            }
          }
          controller.enqueue(
            encoder.encode(JSON.stringify({ done: true }) + "\n"),
          );
        } catch (e) {
          console.error("[chat] stream read error", e);
          controller.enqueue(
            encoder.encode(JSON.stringify({ error: "流读取异常" }) + "\n"),
          );
        } finally {
          close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
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
