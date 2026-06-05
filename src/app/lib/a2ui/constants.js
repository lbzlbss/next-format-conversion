/** MediaFlow A2UI Catalog 标识 */
export const MEDIAFLOW_CHAT_CATALOG_ID = 'mediaflow-chat-v1';

/** 灰度：默认启用；设 NEXT_PUBLIC_A2UI_ENABLED=0 回退 ToolResultCard */
export const A2UI_ENABLED = process.env.NEXT_PUBLIC_A2UI_ENABLED !== '0';
