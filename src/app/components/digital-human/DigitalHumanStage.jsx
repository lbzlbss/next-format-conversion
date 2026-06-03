'use client';

import DigitalHumanCanvas from './DigitalHumanCanvas.jsx';

const STATE_HINT = {
  idle: '待机',
  thinking: '思考中',
  speaking: '回复中',
};

/**
 * @param {{ state: 'idle'|'thinking'|'speaking', className?: string }} props
 */
export function DigitalHumanViewport({ state, className = '' }) {
  return (
    <div className={`relative h-full min-h-0 bg-mf-canvas px-2 pt-6 ${className}`}>
      <DigitalHumanCanvas state={state} />
    </div>
  );
}

/**
 * @param {{ state: 'idle'|'thinking'|'speaking', className?: string }} props
 */
export function DigitalHumanStatusBar({ state, className = '' }) {
  return (
    <div
      className={`flex min-h-[52px] items-center justify-center border-t border-mf-border bg-mf-surface px-2 py-4 text-center text-[10px] text-mf-muted ${className}`}
    >
      MediaFlow 助手 · {STATE_HINT[state] || STATE_HINT.idle}
    </div>
  );
}

/** @deprecated */
export default function DigitalHumanStage({ state, className = '' }) {
  return (
    <aside className={`flex h-full min-h-0 flex-col bg-mf-canvas ${className}`} aria-label="AI 数字人">
      <DigitalHumanViewport state={state} className="flex-1" />
      <DigitalHumanStatusBar state={state} />
    </aside>
  );
}
