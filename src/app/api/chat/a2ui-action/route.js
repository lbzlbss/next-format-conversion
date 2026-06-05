import { NextResponse } from 'next/server';
import { isAllowedA2uiAction } from '../../../lib/a2ui/allowed-actions.js';
import { CHAT_TOOLS } from '../../../lib/chat-tools/registry.js';

export const runtime = 'nodejs';

/**
 * POST /api/chat/a2ui-action
 * Body: { surfaceId, action: { name }, dataModel }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { surfaceId, action, dataModel } = body || {};
    const actionName = action?.name;

    if (!surfaceId || typeof surfaceId !== 'string') {
      return NextResponse.json({ error: 'surfaceId 无效' }, { status: 400 });
    }

    if (!isAllowedA2uiAction(actionName)) {
      return NextResponse.json({ error: '不允许的操作' }, { status: 400 });
    }

    if (actionName === 'start_tool') {
      const session = dataModel?.session;
      const params = dataModel?.params;
      const toolId =
        (typeof params?.toolId === 'string' && CHAT_TOOLS[params.toolId]
          ? params.toolId
          : null) ||
        (typeof session?.toolId === 'string' ? session.toolId : null);

      if (!toolId || !CHAT_TOOLS[toolId]) {
        return NextResponse.json({ error: '未知工具' }, { status: 400 });
      }

      if (!CHAT_TOOLS[toolId].needsFile) {
        return NextResponse.json({ error: '该工具不支持参数表单' }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true, surfaceId, action: actionName });
  } catch (error) {
    console.error('[chat/a2ui-action]', error);
    return NextResponse.json(
      { error: error?.message || '处理失败' },
      { status: 500 },
    );
  }
}
