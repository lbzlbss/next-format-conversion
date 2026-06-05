import fs from "fs";
import path from "path";
import { getSiteName } from "../../_lib/ark.js";

const RUNTIME_START = "<!-- runtime-system -->";
const RUNTIME_END = "<!-- /runtime-system -->";

let cachedPrompt = null;
let cachedMtime = 0;

const FALLBACK_TEMPLATE = `你是{{siteName}}助手，双重身份：①AI创作与视频转换专家 ②八字命理师。说话文雅、有逻辑。

【AI/视频类】回答必须：1.简要说原理 2.步骤化(1.2.3.) 3.给具体参数或Prompt示例。关键词如 **ControlNet**、**Seed值**、**运动强度**、**重绘幅度** 加粗。视频参数：运动强度3-6人像/7-12空镜，重绘0.3-0.5保结构/0.75+改风格，FPS 24或30，结尾可加【技术总结】。

【命理类】回答必须：以「天机虽深，亦有迹可循」开场；结合四柱与五行分析；用断语库经典话术（如财多身弱、伤官配印、甲木参天等）；结尾三段式：【卦象简评】(4字)【五行指引】(喜忌)【AI 创作建议】(建议生成某风格图以补某五行)；最后免责声明「以上仅供娱乐参考，命由天定运由人造」。命理回答后必须引导用户用本站AI功能转运。

【站内工具】系统可在对话中自动调用以下工具（你负责解释参数与结果，不要假装自己执行了二进制转换）：
· GIF：转 WebP、GIF 压缩、GIF 转 MP4
· MP4：压缩、提取首帧（WebP/PNG）
· 图片：JPEG/PNG/WebP 压缩
· 文生图：用户用文字描述画面时调用 generate-image
若用户请求上述能力但未上传文件（文生图除外），提醒其点击 📎 上传。VAP/SVGA/ZIP 批量、去水印等请引导至首页专用工具页。

【约束】仅自称「{{siteName}}助手」；不违法；命理不预测生死/具体灾祸日期。`;

function getSkillPath() {
  return path.join(process.cwd(), "src/app/api/chat/skill.md");
}

function applySiteName(template) {
  return template.replaceAll("{{siteName}}", getSiteName());
}

/**
 * 从 skill.md 的 runtime-system 块读取 System Prompt；缺失时回退内置模板
 */
export function loadSystemPrompt() {
  const skillPath = getSkillPath();
  if (!fs.existsSync(skillPath)) {
    return applySiteName(FALLBACK_TEMPLATE);
  }

  const stat = fs.statSync(skillPath);
  if (cachedPrompt && stat.mtimeMs === cachedMtime) {
    return cachedPrompt;
  }

  const raw = fs.readFileSync(skillPath, "utf8");
  const start = raw.indexOf(RUNTIME_START);
  const end = raw.indexOf(RUNTIME_END);

  let template = FALLBACK_TEMPLATE;
  if (start >= 0 && end > start) {
    const block = raw.slice(start + RUNTIME_START.length, end).trim();
    if (block) template = block;
  }

  cachedPrompt = applySiteName(template);
  cachedMtime = stat.mtimeMs;
  return cachedPrompt;
}
