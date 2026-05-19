/** 火山引擎 Ark 通用配置 */
export const ARK_CHAT_URL =
  "https://ark.cn-beijing.volces.com/api/v3/chat/completions";

/** 对话模型（与改造前一致） */
export const ARK_CHAT_MODEL =
  process.env.ARK_CHAT_MODEL || "doubao-seed-2-0-lite-260215";

export function getChatApiKey() {
  return process.env.ARK_API_KEY2 || process.env.ARK_API_KEY || "";
}

export function getSiteName() {
  return process.env.SITE_NAME || "MediaFlow";
}
