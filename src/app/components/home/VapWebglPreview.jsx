'use client';

import { useEffect } from 'react';
import { Button, Tag } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { useVapWebglPlayer } from '../../hooks/useVapWebglPlayer';

/**
 * video-animation-player WebGL 预览（序列帧转 VAP / VAP 工具共用）
 * @param {{ srcUrl: string | null, vapConfig: object | null, label?: string }} props
 */
export default function VapWebglPreview({ srcUrl, vapConfig, label = 'VAP WebGL 预览' }) {
  const {
    containerRef,
    playing,
    duration,
    currentTime,
    hasAlpha,
    canPlay,
    webglSupported,
    loadError,
    load,
    play,
    pause,
  } = useVapWebglPlayer();

  useEffect(() => {
    if (!srcUrl || !vapConfig) return;
    load(srcUrl, vapConfig);
  }, [load, srcUrl, vapConfig]);

  if (!srcUrl || !vapConfig) return null;

  const fmtTime = (t) => {
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(1).padStart(4, '0');
    return `${m}:${s}`;
  };

  const info = vapConfig?.info ?? vapConfig;

  return (
    <div className="mt-4 rounded-xl border border-mf-border bg-mf-canvas/40 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-mf-text">{label}</span>
        <Tag color="purple">video-animation-player</Tag>
        {info?.w && info?.h ? (
          <Tag color="blue">
            {info.w}×{info.h}
          </Tag>
        ) : null}
      </div>

      {!webglSupported && (
        <p className="mb-2 text-xs text-amber-600">当前浏览器不支持 WebGL</p>
      )}
      {loadError && <p className="mb-2 text-xs text-red-600">{loadError}</p>}

      <div
        className="relative mx-auto overflow-hidden rounded-xl border border-mf-border"
        style={{
          maxWidth: info?.w ? Math.min(Number(info.w), 480) : '100%',
          background: hasAlpha
            ? 'repeating-conic-gradient(#e2e8f0 0% 25%, #f8fafd 0% 50%) 0 0 / 16px 16px'
            : '#000',
        }}
      >
        <div
          ref={containerRef}
          className="flex min-h-[160px] w-full items-center justify-center"
          style={{ minHeight: info?.h ? Math.min(Number(info.h), 320) : 160 }}
        />
      </div>

      <div className="mt-3 flex items-center gap-3">
        <Button
          type="primary"
          shape="circle"
          size="small"
          icon={playing ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          onClick={playing ? pause : play}
          disabled={!canPlay && !playing}
        />
        <span className="text-xs tabular-nums text-mf-muted">
          {fmtTime(currentTime)} / {fmtTime(duration)}
        </span>
      </div>
    </div>
  );
}
