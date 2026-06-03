'use client';

const STATE_LABEL = {
  idle: '待机',
  thinking: '思考中…',
  speaking: '回复中…',
};

/**
 * WebGL 不可用或模型加载失败时的轻量占位
 * @param {{ state: string }} props
 */
export default function Avatar2DFallback({ state }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-b from-mf-accent-soft/40 to-mf-canvas px-4 text-center">
      <div
        className={`grid size-28 place-items-center rounded-full bg-mf-surface shadow-md ring-2 ring-mf-border ${
          state === 'speaking' ? 'animate-pulse' : state === 'thinking' ? 'animate-bounce' : ''
        }`}
        aria-hidden
      >
        <span className="text-5xl">👩‍💼</span>
      </div>
      <div className="text-xs text-mf-muted">数字人（2D 模式）</div>
      <div className="text-sm font-medium text-mf-text">{STATE_LABEL[state] || STATE_LABEL.idle}</div>
    </div>
  );
}
