/** A2UI 用户动作白名单（客户端 / API 共用） */
export const A2UI_ALLOWED_ACTIONS = ['start_tool', 'cancel_tool'];

/**
 * @param {string} name
 */
export function isAllowedA2uiAction(name) {
  return A2UI_ALLOWED_ACTIONS.includes(name);
}
