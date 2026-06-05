import { MEDIAFLOW_CHAT_CATALOG_ID } from './constants.js';

/**
 * LLM 校验失败时的命理摘要卡（静态结构）
 * @param {{ guaxiang?: string, wuxing?: string, aiTip?: string }} [hints]
 */
export function buildFortuneFallbackSurface(hints = {}) {
  const surfaceId = `fortune-fallback-${Date.now()}`;
  const dataModel = {
    fortune: {
      guaxiang: hints.guaxiang || '静观其变',
      wuxing: hints.wuxing || '喜忌请结合四柱具体分析',
      aiTip:
        hints.aiTip ||
        '可使用本站文生图，生成与喜用五行相应的画面（如水族、灯火、山林等）',
    },
  };

  return {
    surfaceId,
    catalogId: MEDIAFLOW_CHAT_CATALOG_ID,
    rootId: 'root',
    components: [
      { id: 'root', component: 'Card', child: 'body' },
      {
        id: 'body',
        component: 'Column',
        children: ['title', 'gx', 'gxVal', 'wx', 'wxVal', 'ai', 'aiVal', 'hint'],
      },
      { id: 'title', component: 'Text', text: '命理指引摘要', variant: 'h4' },
      { id: 'gx', component: 'Text', text: '【卦象简评】', variant: 'muted' },
      { id: 'gxVal', component: 'Text', text: { path: '/fortune/guaxiang' } },
      { id: 'wx', component: 'Text', text: '【五行指引】', variant: 'muted' },
      { id: 'wxVal', component: 'Text', text: { path: '/fortune/wuxing' } },
      { id: 'ai', component: 'Text', text: '【AI 创作建议】', variant: 'muted' },
      { id: 'aiVal', component: 'Text', text: { path: '/fortune/aiTip' } },
      {
        id: 'hint',
        component: 'Text',
        text: '详细解读见下方正文。',
        variant: 'muted',
      },
    ],
    dataModel,
  };
}
