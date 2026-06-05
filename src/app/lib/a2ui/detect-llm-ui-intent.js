/**
 * P2：是否触发辅助 LLM 生成 A2UI（非工具类消息）
 * @param {string} userContent
 * @param {{ toolKey?: string | null }} [context]
 * @returns {'fortune' | 'tutorial' | null}
 */
export function detectLlmUiIntent(userContent, context = {}) {
  if (context.toolKey) return null;

  const q = String(userContent || '').trim();
  if (!q || q.length < 4) return null;

  if (
    /(?:转换完成|下载链接|体积\s*[:：]|beforeBytes|工具执行)/i.test(q) ||
    /^\[工具\]/i.test(q)
  ) {
    return null;
  }

  if (
    /(?:八字|命理|五行|四柱|喜忌|命盘|算命|天干|地支|流年|补运|卦象)/i.test(q)
  ) {
    return 'fortune';
  }

  if (
    /(?:怎么|如何|步骤|教程|怎样|操作流程|使用方法)/i.test(q) &&
    q.length >= 6
  ) {
    return 'tutorial';
  }

  return null;
}
