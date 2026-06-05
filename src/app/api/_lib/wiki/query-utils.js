/**
 * 口语 / 同义词 → 检索词扩展，提升关键词召回
 * @param {string} query
 */
export function expandWikiQuery(query) {
  let q = String(query || "").trim();
  if (!q) return q;

  const rules = [
    [/动图变小|gif\s*瘦身|gif\s*缩小|gif\s*弄小/gi, "GIF 压缩"],
    [/视频变小|mp4\s*瘦身|mp4\s*缩小/gi, "MP4 压缩"],
    [/抽帧|封面图|第一帧|首帧图|thumbnail/gi, "MP4 提取首帧"],
    [/照片压缩|图片变小|jpg\s*压缩|jpeg\s*压缩|png\s*压缩/gi, "图片压缩"],
    [/转成视频|gif\s*转视频|动图转视频/gi, "GIF 转 MP4"],
    [/转成\s*webp|gif\s*转\s*webp/gi, "GIF 转 WebP"],
    [/文生图|ai\s*绘图|生成图片|画一张/gi, "AI 图像生成"],
    [/怎么操作|如何使用|使用步骤/gi, "操作步骤"],
    [/vap\s*花屏|alpha\s*错位|透明通道/gi, "VAP 预览 alpha"],
    [/去水印|消除水印|擦除水印/gi, "视频去水印"],
    [/压缩包|zip\s*转换|批量转换/gi, "压缩包动效转换"],
    [/参数表单|a2ui|确认参数/gi, "A2UI 参数表单"],
  ];

  const extras = [];
  for (const [re, phrase] of rules) {
    if (re.test(q)) extras.push(phrase);
  }

  if (extras.length === 0) return q;
  return `${q}\n${[...new Set(extras)].join(" ")}`;
}

/**
 * 从对话历史拼接检索 query（改善多轮追问召回）
 * @param {Array<{ role: string, content: string }>} messages
 * @param {number} [maxUserTurns]
 */
export function buildRetrievalQuery(messages, maxUserTurns = 3) {
  if (!Array.isArray(messages)) return "";
  const parts = messages
    .filter((m) => m?.role === "user" && typeof m.content === "string")
    .slice(-maxUserTurns)
    .map((m) => m.content.trim())
    .filter(Boolean);
  return parts.join("\n");
}

/**
 * 统一解析检索 query：支持纯字符串或 messages 数组
 * @param {string | { messages?: Array<{ role: string, content: string }>, q?: string }} input
 */
export function resolveWikiQuery(input) {
  if (typeof input === "string") return input.trim();
  if (input?.messages) return buildRetrievalQuery(input.messages);
  if (typeof input?.q === "string") return input.q.trim();
  return "";
}

/**
 * 从 query 推断首页 toolKey，用于无页面上下文时的 Wiki 加权
 * @param {string} query
 * @returns {string | null}
 */
export function inferWikiToolKey(query) {
  const q = String(query || "").toLowerCase();
  if (/webp|转\s*webp/.test(q) && /gif|动图/.test(q)) return "gifToWebp";
  if (/gif.*压缩|压缩.*gif|动图.*压缩/.test(q)) return "gifCompress";
  if (/gif.*mp4|gif.*视频|动图转视频/.test(q)) return "gifToMp4";
  if (/mp4.*压缩|压缩.*mp4|视频.*压缩/.test(q) && !/首帧|抽帧/.test(q)) {
    return "mp4Compress";
  }
  if (/首帧|抽帧|封面|第一帧/.test(q) && /mp4|视频/.test(q)) return "mp4FirstFrame";
  if (/图片压缩|jpeg|jpg|png.*压缩|照片压缩/.test(q)) return "imageCompress";
  if (/文生图|生成.*图|ai.*绘图/.test(q)) return "imageGenerate";
  if (/svga/.test(q)) return "svgaTool";
  if (/vap|alpha|花屏/.test(q)) return "vapTool";
  if (/去水印|水印.*去除|擦除水印/.test(q)) return "videoWatermark";
  if (/压缩包|zip.*转换|批量.*svga|批量.*vap/.test(q)) return "assetZipConvert";
  return null;
}
