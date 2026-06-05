/** MediaFlow A2UI Catalog 标识 */
export const MEDIAFLOW_CHAT_CATALOG_ID = 'mediaflow-chat-v1';

/** 灰度：默认启用；设 NEXT_PUBLIC_A2UI_ENABLED=0 回退 ToolResultCard */
export const A2UI_ENABLED = process.env.NEXT_PUBLIC_A2UI_ENABLED !== '0';

/** P1：模糊意图先展示 ParamForm；设 NEXT_PUBLIC_A2UI_PARAM_FORM=0 关闭 */
export const A2UI_PARAM_FORM_ENABLED =
  A2UI_ENABLED && process.env.NEXT_PUBLIC_A2UI_PARAM_FORM !== '0';
