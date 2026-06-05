/**
 * 轻量意图路由：缩小检索范围
 * @returns {'fortune'|'ai'|'tools'|'general'|'chitchat'}
 */
export function detectIntent(query) {
  const q = query.trim().toLowerCase();
  if (!q) return "chitchat";

  if (/^(你好|您好|hi|hello|hey|在吗|谢谢|感谢)[!！.?？\s]*$/i.test(q)) {
    return "chitchat";
  }

  if (
    /八字|命理|五行|生辰|转运|命盘|四柱|卦象|喜忌|日主|十神|流年|紫微/.test(
      query,
    )
  ) {
    return "fortune";
  }

  if (/a2ui|参数表单|wikiref|确认执行|工具结果卡片/.test(query)) {
    return "tools";
  }

  if (
    /prompt|controlnet|seed|文生图|图生图|重绘|denois|运动强度|fps|图生视频|stable|扩散/.test(
      query,
    )
  ) {
    return "ai";
  }

  if (
    /gif|webp|mp4|svga|vap|压缩|转换|水印|动图|首帧|上传|下载|工具|抽帧|封面|瘦身|变小|调色板|crf|码率|jpeg|jpg|png|照片|花屏|alpha|压缩包/.test(
      query,
    )
  ) {
    return "tools";
  }

  return "general";
}

/**
 * 多轮追问时继承上一轮意图（如「那质量呢？」）
 * @param {string} query
 * @param {Array<{ role: string, content: string }> | null} [messages]
 */
export function resolveWikiIntent(query, messages = null) {
  const intent = detectIntent(query);
  if (intent !== "general" && intent !== "chitchat") return intent;

  if (!Array.isArray(messages)) return intent;

  for (let i = messages.length - 2; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== "user" || typeof m.content !== "string") continue;
    const prev = detectIntent(m.content);
    if (prev !== "general" && prev !== "chitchat") return prev;
  }

  return intent;
}

/** @param {string} intent */
export function categoriesForIntent(intent) {
  switch (intent) {
    case "fortune":
      return ["fortune"];
    case "ai":
      return ["ai", "tools"];
    case "tools":
      return ["tools", "getting-started"];
    case "chitchat":
      return ["getting-started"];
    default:
      return null;
  }
}
