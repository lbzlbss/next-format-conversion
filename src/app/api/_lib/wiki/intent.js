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

  if (
    /prompt|controlnet|seed|文生图|图生图|重绘|denois|运动强度|fps|图生视频|stable|扩散/.test(
      query,
    )
  ) {
    return "ai";
  }

  if (
    /gif|webp|mp4|svga|vap|压缩|转换|水印|动图|首帧|上传|下载|工具/.test(
      query,
    )
  ) {
    return "tools";
  }

  return "general";
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
