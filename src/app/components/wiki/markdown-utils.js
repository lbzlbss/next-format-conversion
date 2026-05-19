/** @param {string} text */
export function slugifyHeading(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]/g, '');
}

/** @param {string} markdown */
export function extractHeadings(markdown) {
  const headings = [];
  for (const line of markdown.split('\n')) {
    if (line.startsWith('## ')) {
      const text = line.slice(3).trim();
      headings.push({ level: 2, text, id: slugifyHeading(text) });
    } else if (line.startsWith('### ')) {
      const text = line.slice(4).trim();
      headings.push({ level: 3, text, id: slugifyHeading(text) });
    }
  }
  return headings;
}

export const CATEGORY_LABEL = {
  'getting-started': '入门指南',
  tools: '工具手册',
  ai: 'AI 创作',
  fortune: '命理参考',
};

export const CATEGORY_DESC = {
  'getting-started': '站点概览与快速上手',
  tools: '各转换工具的操作步骤与参数',
  ai: '文生图、图生视频与 Prompt 技巧',
  fortune: 'AI 对话命理参考（娱乐）',
};
