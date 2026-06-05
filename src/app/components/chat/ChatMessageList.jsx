'use client';

import { BulbOutlined } from '@ant-design/icons';
import A2uiSurfaceHost from '../a2ui/A2uiSurfaceHost';
import { A2UI_ENABLED } from '../../lib/a2ui/constants.js';
import { hasWikiA2uiSurface } from '../../lib/a2ui/build-wiki-sources-surface.js';
import ChatRoleAvatar from './ChatRoleAvatar';
import WikiSources from './WikiSources';
import ChatPdfButton from './ChatPdfButton';
import ToolResultCard from './ToolResultCard';

/**
 * @param {{
 *   messages: Array<Record<string, unknown>>,
 *   streamingThinking?: string,
 *   streamingContent?: string,
 *   streamingSources?: Array<{ slug: string, title: string }>,
 *   streamingToolCalls?: import('../../hooks/useChatStream.js').ToolCall[],
 *   streamingSurfaces?: import('../../lib/a2ui/build-tool-result-surface.js').A2uiSurfaceState[],
 *   runningSurfaces?: import('../../lib/a2ui/build-tool-result-surface.js').A2uiSurfaceState[],
 *   interactiveSurfaceId?: string | null,
 *   onSurfaceAction?: (surfaceId: string, action: string, dataModel: Record<string, unknown>) => void,
 *   loading?: boolean,
 *   toolRunning?: boolean,
 *   variant?: 'page' | 'float',
 * }} props
 */
export default function ChatMessageList({
  messages,
  streamingThinking = '',
  streamingContent = '',
  streamingSources = [],
  streamingToolCalls = [],
  streamingSurfaces = [],
  runningSurfaces = [],
  interactiveSurfaceId = null,
  onSurfaceAction,
  loading = false,
  toolRunning = false,
  variant = 'page',
}) {
  const isPage = variant === 'page';

  const showStreaming =
    loading ||
    toolRunning ||
    Boolean(streamingThinking) ||
    Boolean(streamingContent) ||
    (streamingSources?.length ?? 0) > 0 ||
    (streamingToolCalls?.length ?? 0) > 0 ||
    (streamingSurfaces?.length ?? 0) > 0 ||
    (runningSurfaces?.length ?? 0) > 0;

  return (
    <div className={isPage ? 'mx-auto max-w-3xl space-y-5' : 'space-y-4'}>
      {messages.map((m) => (
        <div
          key={String(m.id)}
          className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
        >
          <ChatRoleAvatar role={String(m.role)} size={isPage ? 40 : 36} />
          <div className={isPage ? 'min-w-0 max-w-[min(85%,720px)]' : 'max-w-[85%]'}>
            {m.thinking ? (
              <div className="mb-2 rounded-xl border border-mf-border bg-mf-accent-soft px-4 py-3 text-xs text-mf-accent-soft-fg">
                <div className="mb-1 flex items-center gap-1 font-semibold">
                  <BulbOutlined />
                  思考过程
                </div>
                <div className="whitespace-pre-wrap break-words opacity-90">
                  {String(m.thinking)}
                </div>
              </div>
            ) : null}
            <div
              className={
                m.role === 'user'
                  ? isPage
                    ? 'rounded-2xl rounded-tr-md bg-mf-cta px-4 py-3 text-sm text-white'
                    : 'rounded-2xl rounded-tr-md bg-mf-cta px-4 py-2 text-[13px] text-white'
                  : isPage
                    ? 'rounded-2xl rounded-tl-md bg-mf-surface px-4 py-3 text-sm text-mf-text shadow-sm ring-1 ring-mf-border'
                    : 'rounded-2xl rounded-tl-md bg-[#f1f5f9] px-4 py-2 text-[13px] text-[#0f172a]'
              }
            >
              {Array.isArray(m.attachments) && m.attachments.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-2">
                  {m.attachments.map((att) => (
                    <div key={String(att.id)} className="rounded-lg bg-black/10 p-1">
                      {att.previewUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={String(att.previewUrl)}
                          alt={String(att.name)}
                          className="max-h-20 rounded object-contain"
                        />
                      ) : (
                        <span className="text-xs opacity-90">{String(att.name)}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
              {m.role === 'assistant' && A2UI_ENABLED && Array.isArray(m.surfaces) && m.surfaces.length > 0 ? (
                <A2uiSurfaceHost
                  surfaces={m.surfaces}
                  variant={variant}
                  interactiveSurfaceId={interactiveSurfaceId}
                  onSurfaceAction={onSurfaceAction}
                />
              ) : null}
              <div className="whitespace-pre-wrap break-words">{String(m.content)}</div>
              {m.role === 'assistant' && !A2UI_ENABLED && Array.isArray(m.toolCalls)
                ? m.toolCalls.map((tc) => (
                    <ToolResultCard key={String(tc.id)} toolCall={tc} />
                  ))
                : null}
              {m.role === 'assistant' &&
              Array.isArray(m.sources) &&
              m.sources.length > 0 &&
              !(A2UI_ENABLED && hasWikiA2uiSurface(m.surfaces)) ? (
                <WikiSources sources={m.sources} />
              ) : null}
              {m.role === 'assistant' && m.id !== 'welcome' ? (
                <div
                  className={
                    isPage
                      ? 'mt-2 flex justify-end border-t border-mf-border/60 pt-2'
                      : 'mt-2 flex justify-end border-t border-[#e2e8f0] pt-2'
                  }
                >
                  <ChatPdfButton
                    mode="single"
                    messages={messages}
                    singleMessage={m}
                    type="link"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ))}

      {showStreaming ? (
        <div className="flex gap-3">
          <ChatRoleAvatar role="assistant" size={isPage ? 40 : 36} />
          <div className={isPage ? 'min-w-0 max-w-[min(85%,720px)]' : 'max-w-[85%]'}>
            {streamingThinking ? (
              <div className="mb-2 rounded-xl border border-mf-border bg-mf-accent-soft px-4 py-3 text-xs text-mf-accent-soft-fg">
                <div className="mb-1 flex items-center gap-1 font-semibold">
                  <BulbOutlined />
                  正在思考…
                </div>
                <div className="whitespace-pre-wrap break-words opacity-90">
                  {streamingThinking}
                </div>
              </div>
            ) : null}
            <div
              className={
                isPage
                  ? 'rounded-2xl rounded-tl-md bg-mf-surface px-4 py-3 text-sm text-mf-text shadow-sm ring-1 ring-mf-border'
                  : 'rounded-2xl rounded-tl-md bg-[#f1f5f9] px-4 py-2 text-[13px] text-[#0f172a]'
              }
            >
              {A2UI_ENABLED && streamingSurfaces.length > 0 ? (
                <A2uiSurfaceHost
                  surfaces={streamingSurfaces}
                  variant={variant}
                  interactiveSurfaceId={interactiveSurfaceId}
                  onSurfaceAction={onSurfaceAction}
                />
              ) : null}
              {!A2UI_ENABLED
                ? streamingToolCalls.map((tc) => (
                    <ToolResultCard key={String(tc.id)} toolCall={tc} />
                  ))
                : null}
              {A2UI_ENABLED && toolRunning && runningSurfaces.length > 0 && streamingSurfaces.length === 0 ? (
                <A2uiSurfaceHost
                  surfaces={runningSurfaces}
                  variant={variant}
                  interactiveSurfaceId={interactiveSurfaceId}
                  onSurfaceAction={onSurfaceAction}
                />
              ) : null}
              {!A2UI_ENABLED && toolRunning && !streamingContent && streamingToolCalls.length === 0 ? (
                <ToolResultCard
                  toolCall={{
                    id: 'running',
                    toolId: 'gif.convertToWebp',
                    status: 'running',
                  }}
                />
              ) : null}
              <div className="whitespace-pre-wrap break-words">
                {streamingContent || (
                  <div className={isPage ? 'animate-pulse text-mf-muted' : 'animate-pulse text-[#64748b]'}>
                    {toolRunning
                      ? '正在转换 GIF…'
                      : streamingThinking
                        ? '正在组织回复…'
                        : '正在思考…'}
                  </div>
                )}
              </div>
              {streamingSources?.length > 0 &&
              !(A2UI_ENABLED && hasWikiA2uiSurface(streamingSurfaces)) ? (
                <WikiSources sources={streamingSources} />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
