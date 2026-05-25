'use client';

/** 工具面板懒加载占位，固定高度降低 CLS */
export default function ToolPanelSkeleton() {
  return (
    <div
      className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-mf-border bg-mf-canvas/60"
      role="status"
      aria-live="polite"
      aria-label="工具加载中"
    >
      <div className="size-8 animate-spin rounded-full border-2 border-mf-border border-t-mf-cta" />
      <p className="text-sm text-mf-muted">正在加载工具模块…</p>
    </div>
  );
}
