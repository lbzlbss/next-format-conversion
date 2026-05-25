'use client';

import { SettingOutlined } from '@ant-design/icons';
import { VapProvider, VapMain, VapEditPanel } from '../VapToolInternal';

/**
 * VAP 工具整页工作区，单独 chunk 按需加载（含 video-animation-player）
 */
export default function VapWorkspace({ label, description }) {
  return (
    <VapProvider>
      <section className="min-w-0 flex-1">
        <div className="mf-card p-4 md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-[16px] font-semibold text-mf-text">{label}</div>
              <p className="text-[12px] text-mf-muted">{description}</p>
            </div>
          </div>
          <div className="min-w-0">
            <VapMain />
          </div>
        </div>
      </section>
      <aside className="flex min-h-0 w-full shrink-0 flex-col md:w-[360px]">
        <div className="mf-card p-5">
          <div className="flex items-center justify-between">
            <div className="text-[14px] font-bold text-mf-text">VAP 配置 & 导出</div>
            <span className="text-mf-muted">
              <SettingOutlined />
            </span>
          </div>
          <div className="mt-4 min-h-0 flex-1 space-y-4 text-[12px] text-mf-muted">
            <VapEditPanel />
          </div>
        </div>
      </aside>
    </VapProvider>
  );
}
