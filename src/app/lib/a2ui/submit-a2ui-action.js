/**
 * 提交 A2UI 用户动作（P1 鉴权与校验层）
 * @param {{
 *   surfaceId: string,
 *   action: string,
 *   dataModel: Record<string, unknown>,
 * }} payload
 */
export async function submitA2uiAction({ surfaceId, action, dataModel }) {
  const res = await fetch('/api/chat/a2ui-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      surfaceId,
      action: { name: action },
      dataModel,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText || '操作失败');
  }

  return res.json();
}
